/**
 * Indice de poussée (0–100) à partir de la météo journalière.
 *
 * Heuristique volontairement simple et lisible, inspirée des règles empiriques
 * des cueilleurs : une bonne pluie (≥ 30–40 mm) suivie de 7 à 12 jours de
 * douceur (8–18 °C de moyenne), sans gel ni coup de sec.
 * C'est une INDICATION météo, pas une prévision de présence de champignons :
 * le sol, l'essence d'arbre, l'altitude et l'espèce comptent tout autant.
 *
 * w : { rain[], tmin[], tmax[], todayIndex } — index todayIndex = aujourd'hui.
 */

const sum = a => a.reduce((s, v) => s + (v || 0), 0);
const mean = a => (a.length ? sum(a) / a.length : 0);

export function computeFlushScore(w) {
  const t = w.todayIndex;
  const rain = w.rain;
  const tmean = w.tmin.map((v, i) => (v + w.tmax[i]) / 2);
  const reasons = [];
  let score = 0;

  // 1) Cumul de pluie sur la fenêtre utile : J-14 à J-3
  const rainWindow = sum(rain.slice(Math.max(0, t - 14), t - 2));
  if (rainWindow >= 60) score += 45;
  else if (rainWindow >= 40) score += 40;
  else if (rainWindow >= 25) score += 30;
  else if (rainWindow >= 10) score += 15;
  reasons.push(`${Math.round(rainWindow)} mm de pluie sur les deux dernières semaines`);

  // 2) Un vrai épisode pluvieux (≥ 20 mm en 3 jours) il y a 5 à 12 jours
  let bestEpisode = 0;
  for (let i = t - 12; i <= t - 5 - 2; i++) {
    if (i < 0) continue;
    bestEpisode = Math.max(bestEpisode, sum(rain.slice(i, i + 3)));
  }
  if (bestEpisode >= 20) {
    score += 15;
    reasons.push(`épisode pluvieux marqué (${Math.round(bestEpisode)} mm en 3 jours) il y a 5 à 12 jours`);
  }

  // 3) Douceur : moyenne des 7 derniers jours et des 3 prochains
  const temp = mean([...tmean.slice(t - 7, t), ...tmean.slice(t, t + 3)]);
  if (temp >= 8 && temp <= 18) { score += 25; reasons.push(`températures favorables (${temp.toFixed(1)} °C de moyenne)`); }
  else if (temp >= 5 && temp <= 22) { score += 12; reasons.push(`températures moyennement favorables (${temp.toFixed(1)} °C)`); }
  else reasons.push(`températures défavorables (${temp.toFixed(1)} °C)`);

  // 4) Gel récent ou annoncé
  if (w.tmin.slice(t - 5, t + 1).some(v => v <= 0)) { score -= 25; reasons.push('gel ces derniers jours'); }
  else if (w.tmin.slice(t + 1, t + 4).some(v => v <= 0)) { score -= 10; reasons.push('gel annoncé'); }

  // 5) Coup de sec : chaleur sans pluie ces 3 derniers jours
  if (sum(rain.slice(t - 3, t)) < 1 && Math.max(...w.tmax.slice(t - 3, t + 1)) > 25) {
    score -= 10; reasons.push('chaleur sèche récente');
  }

  // 6) Pluie annoncée qui entretient l'humidité
  if (sum(rain.slice(t, t + 3)) >= 5) { score += 5; reasons.push('pluie annoncée dans les 3 jours'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 75 ? 'excellente' : score >= 55 ? 'bonne' : score >= 30 ? 'moyenne' : 'faible';
  return { score, level, reasons, rain14: Math.round(rainWindow), temp: Math.round(temp * 10) / 10 };
}

export function alertThreshold() {
  return Number(process.env.FLUSH_ALERT_THRESHOLD || 60);
}
