/**
 * Alerts Module
 * Handles alert condition checking and delivery (webhook/email)
 * MIT License
 */

import type { Alert, AlertDetails, AlertType, ProxyConfig } from './types.js';
import {
  getEnabledAlertsByProjectId,
  getBudget,
  getTodaySpend,
  getAverageDailySpend,
  updateAlertLastTriggered,
  recordAlertHistory,
} from './db.js';
import { getBudgetUtilization } from './budget.js';

// 1 hour cooldown between same alert triggers
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Check and trigger alerts for a project after a request
 * This should be called after recording usage
 */
export async function checkAndTriggerAlerts(
  projectId: string,
  config: ProxyConfig
): Promise<void> {
  const alerts = getEnabledAlertsByProjectId(projectId);

  if (alerts.length === 0) return;

  for (const alert of alerts) {
    // Check cooldown - don't re-trigger same alert within 1 hour
    if (alert.lastTriggeredAt) {
      const timeSinceLastTrigger = Date.now() - alert.lastTriggeredAt.getTime();
      if (timeSinceLastTrigger < ALERT_COOLDOWN_MS) {
        continue;
      }
    }

    const shouldTrigger = checkAlertCondition(alert, projectId);
    if (shouldTrigger) {
      const details = buildAlertDetails(alert, projectId);
      await triggerAlert(alert, details, config);
    }
  }
}

/**
 * Check if an alert's condition is met
 */
function checkAlertCondition(alert: Alert, projectId: string): boolean {
  switch (alert.type) {
    case 'budget_warning':
      return checkBudgetWarning(projectId, alert.threshold);

    case 'budget_exceeded':
      return checkBudgetExceeded(projectId);

    case 'daily_spend_spike':
      return checkDailySpendSpike(projectId, alert.threshold);

    default:
      return false;
  }
}

/**
 * Check if budget utilization exceeds warning threshold (default 80%)
 */
function checkBudgetWarning(projectId: string, thresholdPercent: number): boolean {
  const utilization = getBudgetUtilization(projectId);
  if (utilization === null) return false;

  return utilization >= thresholdPercent && utilization < 100;
}

/**
 * Check if budget is exceeded (100%+)
 */
function checkBudgetExceeded(projectId: string): boolean {
  const utilization = getBudgetUtilization(projectId);
  if (utilization === null) return false;

  return utilization >= 100;
}

/**
 * Check if today's spend is > threshold x average daily spend
 */
function checkDailySpendSpike(projectId: string, multiplier: number): boolean {
  const todaySpend = getTodaySpend(projectId);
  const averageSpend = getAverageDailySpend(projectId);

  // Need some history to compare against
  if (averageSpend === 0) return false;

  return todaySpend > averageSpend * multiplier;
}

/**
 * Build detailed alert information
 */
function buildAlertDetails(alert: Alert, projectId: string): AlertDetails {
  const budget = getBudget(projectId);
  const utilization = getBudgetUtilization(projectId);
  const todaySpend = getTodaySpend(projectId);
  const averageSpend = getAverageDailySpend(projectId);

  let message: string;

  switch (alert.type) {
    case 'budget_warning':
      message = `Budget warning: Project "${projectId}" has used ${utilization?.toFixed(1)}% of its $${budget?.limitUsd.toFixed(2)} budget.`;
      break;

    case 'budget_exceeded':
      message = `Budget exceeded: Project "${projectId}" has exceeded its $${budget?.limitUsd.toFixed(2)} budget (currently at $${budget?.spentUsd.toFixed(2)}).`;
      break;

    case 'daily_spend_spike':
      message = `Daily spend spike: Project "${projectId}" has spent $${todaySpend.toFixed(4)} today, which is ${(todaySpend / averageSpend).toFixed(1)}x the average daily spend of $${averageSpend.toFixed(4)}.`;
      break;

    default:
      message = `Alert triggered for project "${projectId}".`;
  }

  return {
    alertType: alert.type,
    projectId,
    currentSpendUsd: budget?.spentUsd ?? todaySpend,
    budgetLimitUsd: budget?.limitUsd,
    budgetUtilizationPercent: utilization ?? undefined,
    dailyAverageSpendUsd: averageSpend || undefined,
    todaySpendUsd: todaySpend || undefined,
    triggeredAt: new Date().toISOString(),
    message,
  };
}

/**
 * Trigger an alert - send webhook and/or email
 */
async function triggerAlert(
  alert: Alert,
  details: AlertDetails,
  config: ProxyConfig
): Promise<void> {
  console.log(`[Alert] Triggering ${alert.type} alert for project ${alert.projectId}`);
  console.log(`[Alert] ${details.message}`);

  // Record in history
  recordAlertHistory(alert.id, JSON.stringify(details));

  // Update last triggered timestamp
  updateAlertLastTriggered(alert.id);

  // Send webhook if configured
  if (alert.webhookUrl) {
    await sendWebhook(alert.webhookUrl, details);
  }

  // Send email if configured
  if (alert.email) {
    await sendEmail(alert.email, details, config);
  }
}

/**
 * Send webhook notification
 */
async function sendWebhook(url: string, details: AlertDetails): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Tokencap-Alerts/1.0',
      },
      body: JSON.stringify({
        event: 'alert.triggered',
        alert: details,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`[Alert] Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Alert] Webhook sent successfully to ${url}`);
    }
  } catch (error) {
    console.error(`[Alert] Webhook error:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Send email notification using Resend API
 */
async function sendEmail(
  to: string,
  details: AlertDetails,
  config: ProxyConfig
): Promise<void> {
  const resendApiKey = config.resendApiKey || process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log(`[Alert] Email would be sent to ${to} (Resend API key not configured)`);
    console.log(`[Alert] Subject: Tokencap Alert: ${getAlertSubject(details.alertType)}`);
    console.log(`[Alert] Body: ${details.message}`);
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Tokencap Alerts <alerts@tokencap.dev>',
        to: [to],
        subject: `Tokencap Alert: ${getAlertSubject(details.alertType)}`,
        html: buildEmailHtml(details),
        text: buildEmailText(details),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Alert] Email failed: ${response.status} ${errorBody}`);
    } else {
      console.log(`[Alert] Email sent successfully to ${to}`);
    }
  } catch (error) {
    console.error(`[Alert] Email error:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Get human-readable alert subject
 */
function getAlertSubject(alertType: AlertType): string {
  switch (alertType) {
    case 'budget_warning':
      return 'Budget Warning';
    case 'budget_exceeded':
      return 'Budget Exceeded';
    case 'daily_spend_spike':
      return 'Daily Spend Spike Detected';
    default:
      return 'Alert';
  }
}

/**
 * Build HTML email body
 */
function buildEmailHtml(details: AlertDetails): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
    .alert-type { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .budget-warning { background: #ffc107; color: #000; }
    .budget-exceeded { background: #dc3545; color: #fff; }
    .daily-spend-spike { background: #fd7e14; color: #fff; }
    .metric { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    .metric-label { font-size: 12px; color: #666; }
    .metric-value { font-size: 18px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Tokencap Alert</h1>
      <span class="alert-type ${details.alertType.replace('_', '-')}">${getAlertSubject(details.alertType)}</span>
    </div>
    <div class="content">
      <p>${details.message}</p>

      <div class="metric">
        <div class="metric-label">Project</div>
        <div class="metric-value">${details.projectId}</div>
      </div>

      ${details.budgetLimitUsd !== undefined ? `
      <div class="metric">
        <div class="metric-label">Budget</div>
        <div class="metric-value">$${details.currentSpendUsd.toFixed(4)} / $${details.budgetLimitUsd.toFixed(2)}</div>
      </div>
      ` : ''}

      ${details.budgetUtilizationPercent !== undefined ? `
      <div class="metric">
        <div class="metric-label">Utilization</div>
        <div class="metric-value">${details.budgetUtilizationPercent.toFixed(1)}%</div>
      </div>
      ` : ''}

      ${details.todaySpendUsd !== undefined ? `
      <div class="metric">
        <div class="metric-label">Today's Spend</div>
        <div class="metric-value">$${details.todaySpendUsd.toFixed(4)}</div>
      </div>
      ` : ''}

      ${details.dailyAverageSpendUsd !== undefined ? `
      <div class="metric">
        <div class="metric-label">Daily Average</div>
        <div class="metric-value">$${details.dailyAverageSpendUsd.toFixed(4)}</div>
      </div>
      ` : ''}

      <p style="margin-top: 20px;">
        <a href="https://tokencap.dev/dashboard" style="background: #1a1a2e; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none;">View Dashboard</a>
      </p>
    </div>
    <div class="footer">
      <p>This alert was triggered at ${new Date(details.triggeredAt).toLocaleString()}</p>
      <p>Tokencap - Know your AI costs before you run</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Build plain text email body
 */
function buildEmailText(details: AlertDetails): string {
  let text = `TOKENCAP ALERT: ${getAlertSubject(details.alertType)}\n\n`;
  text += `${details.message}\n\n`;
  text += `Project: ${details.projectId}\n`;

  if (details.budgetLimitUsd !== undefined) {
    text += `Budget: $${details.currentSpendUsd.toFixed(4)} / $${details.budgetLimitUsd.toFixed(2)}\n`;
  }

  if (details.budgetUtilizationPercent !== undefined) {
    text += `Utilization: ${details.budgetUtilizationPercent.toFixed(1)}%\n`;
  }

  if (details.todaySpendUsd !== undefined) {
    text += `Today's Spend: $${details.todaySpendUsd.toFixed(4)}\n`;
  }

  if (details.dailyAverageSpendUsd !== undefined) {
    text += `Daily Average: $${details.dailyAverageSpendUsd.toFixed(4)}\n`;
  }

  text += `\nTriggered at: ${new Date(details.triggeredAt).toLocaleString()}\n`;
  text += `\n---\nTokencap - Know your AI costs before you run\nhttps://tokencap.dev`;

  return text;
}

/**
 * Get default threshold for an alert type
 */
export function getDefaultThreshold(type: AlertType): number {
  switch (type) {
    case 'budget_warning':
      return 80; // 80% of budget
    case 'budget_exceeded':
      return 100; // 100% of budget
    case 'daily_spend_spike':
      return 2; // 2x average daily spend
    default:
      return 80;
  }
}

/**
 * Validate alert type
 */
export function isValidAlertType(type: string): type is AlertType {
  return ['budget_warning', 'budget_exceeded', 'daily_spend_spike'].includes(type);
}
