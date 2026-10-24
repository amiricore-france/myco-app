/**
 * Tâche quotidienne — lancée par deploy/myco-alerts.timer :
 *   - alertes de poussée (Premium) ;
 *   - purge des signalements de danger de plus de DANGER_RETENTION_DAYS jours.
 *
 *   node --env-file=.env src/jobs/flush-alerts.js            → exécute
 *   node --env-file=.env src/jobs/flush-alerts.js --dry-run  → calcule sans rien envoyer ni supprimer
 */
import 'dotenv/config';
import { runDailyAlerts } from '../lib/alerts.js';
import { purgeDangerReports } from '../lib/dangers.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const r = await runDailyAlerts({ dryRun });
  console.log(`[alerts] terminé : ${r.notified}/${r.users} utilisateur(s) notifié(s)${dryRun ? ' (simulation)' : ''}`);
  if (!dryRun) {
    const purged = await purgeDangerReports();
    console.log(`[dangers] ${purged} signalement(s) de plus d'un an supprimé(s)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('[alerts] échec :', e); process.exit(1); });
