/**
 * Alertes de poussée quotidiennes — lancé par deploy/myco-alerts.timer.
 *   node src/jobs/flush-alerts.js            → envoie les alertes
 *   node src/jobs/flush-alerts.js --dry-run  → calcule sans rien envoyer
 */
import 'dotenv/config';
import { runDailyAlerts } from '../lib/alerts.js';

const dryRun = process.argv.includes('--dry-run');
runDailyAlerts({ dryRun })
  .then(r => { console.log(`[alerts] terminé : ${r.notified}/${r.users} utilisateur(s) notifié(s)${dryRun ? ' (simulation)' : ''}`); process.exit(0); })
  .catch(e => { console.error('[alerts] échec :', e); process.exit(1); });
