import AnalyticsPage from 'pages/analytics';
import ChangeRequest from 'pages/change-request';
import ComparativeInsightsPage from 'pages/comparative-insights';
import DashboardPage from 'pages/dashboard';
import EnterprisePage from 'pages/enterprise';
import Issues from 'pages/issues';
import RiskAssessment from 'pages/risk-assessment';
import UtilitiesPage from 'pages/utilities';

export const routes = [
  { path: '/dashboard', component: DashboardPage },
  { path: '/utilities', component: UtilitiesPage },
  { path: '/enterprise', component: EnterprisePage },
  { path: '/change-request', component: ChangeRequest },
  { path: '/risk-assessment', component: RiskAssessment },
  { path: '/issues', component: Issues },
  { path: '/analytics', component: AnalyticsPage },
  { path: '/comparative-insights', component: ComparativeInsightsPage },
];
