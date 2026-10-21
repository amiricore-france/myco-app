"""
BioCLIP microservice — identification de champignons.
Tourne sur le port 5000. Appelé par le backend Node.js.
"""
import os
# Limite l'usage CPU de PyTorch (evite la surchauffe sur CPU sans GPU)
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")

import io
import json
import time
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
from PIL import Image
from bioclip import CustomLabelsClassifier
from bioclip.predict import OPENA_AI_IMAGENET_TEMPLATE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bioclip")

app = FastAPI(title="BioCLIP Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_species_labels():
    """
    Charge les noms latins depuis data/species.json (source unique de verite).
    Essaie plusieurs emplacements pour etre robuste.
    """
    candidates = [
        Path(__file__).resolve().parent.parent / "data" / "species.json",
        Path.cwd().parent / "data" / "species.json",
        Path.cwd() / ".." / "data" / "species.json",
        Path("/home/renaud/myco-app/data/species.json"),
    ]

    for p in candidates:
        if p.exists():
            logger.info(f"Chargement des especes depuis {p}")
            with open(p, "r", encoding="utf-8") as f:
                species = json.load(f)

            seen = set()
            labels = []
            for s in species:
                latin = s.get("latin")
                if latin and latin not in seen:
                    seen.add(latin)
                    labels.append(latin)

            logger.info(f"{len(labels)} especes chargees")
            return labels

    raise FileNotFoundError(
        "Impossible de trouver data/species.json. Emplacements essayes : "
        + ", ".join(str(p) for p in candidates)
    )


logger.info("Chargement de la liste des especes...")
SPECIES_LABELS = load_species_labels()
logger.info(f"Classifieur BioCLIP pret avec {len(SPECIES_LABELS)} labels")

# Cache disque des empreintes texte des especes. Leur calcul (80 gabarits par
# espece) prend plusieurs minutes sur CPU et donne toujours le meme resultat.
TXT_CACHE_FILE = Path(
    os.environ.get("BIOCLIP_CACHE_DIR", Path(__file__).resolve().parent / ".cache")
) / "txt_embeddings.pt"


def _cache_signature(model_str: str) -> dict:
    return {"model": model_str, "templates": len(OPENA_AI_IMAGENET_TEMPLATE)}


class CachedLabelsClassifier(CustomLabelsClassifier):
    """CustomLabelsClassifier dont les empreintes texte sont mises en cache sur
    disque, espece par espece : seules les especes nouvelles sont calculees."""

    @torch.no_grad()
    def _get_txt_embeddings(self, classnames):
        signature = _cache_signature(self.model_str)
        cache = {}
        try:
            data = torch.load(TXT_CACHE_FILE, weights_only=True)
            if data.get("signature") == signature:
                cache = data["embeddings"]
            else:
                logger.info("Cache d'empreintes obsolete (modele change) : ignore")
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning(f"Cache d'empreintes illisible, recalcul : {e}")

        missing = [c for c in classnames if c not in cache]
        if missing:
            logger.info(f"Calcul des empreintes pour {len(missing)} espece(s)...")
            computed = super()._get_txt_embeddings(missing)
            for i, c in enumerate(missing):
                cache[c] = computed[:, i].cpu()
            try:
                TXT_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                tmp = TXT_CACHE_FILE.with_suffix(".tmp")
                torch.save({"signature": signature, "embeddings": cache}, tmp)
                tmp.replace(TXT_CACHE_FILE)
            except Exception as e:
                logger.warning(f"Impossible d'ecrire le cache d'empreintes : {e}")
        logger.info(f"Empreintes : {len(classnames) - len(missing)} en cache, {len(missing)} calculee(s)")

        return torch.stack([cache[c].to(self.device) for c in classnames], dim=1)


classifier: Optional[CustomLabelsClassifier] = None


@app.on_event("startup")
def load_model():
    global classifier
    try:
        torch.set_num_threads(2)
        logger.info("PyTorch limite a 2 threads CPU")

        classifier = CachedLabelsClassifier(cls_ary=SPECIES_LABELS)
        logger.info("BioCLIP charge avec succes")
    except Exception as e:
        logger.exception(f"Echec du chargement du modele : {e}")


@app.get("/health")
def health():
    return {
        "ok": classifier is not None,
        "model": "bioclip",
        "num_labels": len(SPECIES_LABELS),
        "labels_sample": SPECIES_LABELS[:5],
    }


def _normalize_predictions(raw):
    """
    Normalise le retour de pybioclip en [{'class': str, 'score': float}, ...].

    pybioclip 2.1.6 renvoie :
      [{'file_name': '0', 'classification': 'Macrolepiota procera', 'score': 0.99}, ...]
    """
    if raw is None:
        return []

    if isinstance(raw, dict):
        return sorted(
            [{"class": str(k), "score": float(v)} for k, v in raw.items()],
            key=lambda x: -x["score"],
        )

    if not isinstance(raw, list):
        return []

    if raw and isinstance(raw[0], list):
        raw = raw[0]

    result = []
    for item in raw:
        if isinstance(item, dict):
            cls = (
                item.get("classification")
                or item.get("class")
                or item.get("label")
                or item.get("species")
            )
            sc = (
                item.get("score")
                if "score" in item
                else item.get("prob", item.get("probability", 0.0))
            )
            if cls is not None:
                result.append({"class": str(cls), "score": float(sc or 0.0)})
        elif isinstance(item, (tuple, list)) and len(item) == 2:
            result.append({"class": str(item[0]), "score": float(item[1])})

    return sorted(result, key=lambda x: -x["score"])


@app.post("/identify")
async def identify(file: UploadFile = File(...)):
    if classifier is None:
        raise HTTPException(status_code=503, detail="Modele BioCLIP non charge")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Fichier image requis")

    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image invalide : {e}")

    t0 = time.time()
    try:
        raw = classifier.predict(images=[img], k=5)
    except TypeError:
        try:
            raw = classifier.predict(images=[img])
        except TypeError:
            raw = classifier.predict([img])

    elapsed_ms = round((time.time() - t0) * 1000)
    logger.info(f"RAW pybioclip type={type(raw).__name__} value={raw}")

    top = _normalize_predictions(raw)[:5]
    primary = top[0] if top else None

    if not primary:
        return {
            "provider": "bioclip",
            "inference_time_ms": elapsed_ms,
            "identified": False,
            "confidence": 0.0,
            "primary_species": None,
            "alternatives": [],
            "observed_features": [],
            "reasoning": "Aucune prediction retournee par BioCLIP.",
            "warning": "En cas de doute, abstenez-vous. Une erreur peut etre mortelle.",
        }

    return {
        "provider": "bioclip",
        "inference_time_ms": elapsed_ms,
        "identified": primary["score"] > 0.10,
        "confidence": primary["score"],
        "primary_species": {
            "latin": primary["class"],
            "common_fr": None,
        },
        "alternatives": [
            {"latin": p["class"], "common_fr": None, "confidence": p["score"]}
            for p in top[1:]
        ],
        "observed_features": [],
        "reasoning": "Identification par BioCLIP 2 (modele specialise biologie, entraine sur 214M d'images).",
        "warning": "En cas de doute, abstenez-vous. Une erreur peut etre mortelle.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
