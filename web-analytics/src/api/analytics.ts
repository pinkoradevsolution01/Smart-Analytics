export type Range = { from: string; to: string };
export type SeriesPoint = { date: string; gross: number; net: number; orders: number };
export type Overview = {
  kpis: { grossSales: number; discounts: number; netSales: number; transactions: number; averageOrderValue: number; itemsSold: number; activeCustomers: number; lowStockCount: number };
  comparisons: { previousPeriod: { from: string; to: string }; netSales: number | null; transactions: number | null; averageOrderValue: number | null };
  dataHealth: { lastSuccessfulSync: string | null; lastFailedSync: string | null; status: 'synced' | 'awaiting_sync' };
  salesSeries: SeriesPoint[];
  payments: { name: string; value: number; color: string }[];
  topProducts: { name: string; sold: number; revenue: number }[];
  lowStock: { name: string; quantity: number; threshold: number; status: 'Low' | 'Out of stock' }[];
  recentActivity: { type: string; title: string; time: string; icon: string; severity?: string }[];
  meta: { generatedAt: string; timezone: string; businessName: string };
};
const mock: Overview = { kpis: { grossSales: 142800, discounts: 6980, netSales: 135820, transactions: 429, averageOrderValue: 316.60, itemsSold: 836, activeCustomers: 292, lowStockCount: 12 }, comparisons: { previousPeriod: { from: '2026-06-28', to: '2026-07-27' }, netSales: 12.8, transactions: 8.4, averageOrderValue: 4.1 }, dataHealth: { lastSuccessfulSync: new Date().toISOString(), lastFailedSync: null, status: 'synced' }, salesSeries: [{date:'Jul 28',gross:11800,net:10400,orders:34},{date:'Jul 31',gross:14600,net:13800,orders:46},{date:'Aug 03',gross:10200,net:9300,orders:31},{date:'Aug 06',gross:16500,net:15300,orders:52},{date:'Aug 09',gross:15100,net:14200,orders:47},{date:'Aug 12',gross:18900,net:17700,orders:58},{date:'Aug 15',gross:17900,net:16500,orders:53},{date:'Aug 18',gross:20400,net:19100,orders:62}], payments: [{name:'Cash',value:48,color:'#0d9488'},{name:'GCash',value:30,color:'#60a5fa'},{name:'Card',value:16,color:'#f59e0b'},{name:'Bank',value:6,color:'#a78bfa'}], topProducts: [{name:'Classic Crew Tee',sold:124,revenue:31000},{name:'Essential Canvas Tote',sold:92,revenue:23000},{name:'Linen Blend Shirt',sold:76,revenue:34200},{name:'Wide Leg Trousers',sold:64,revenue:32000}], lowStock: [{name:'Classic Crew Tee — White / M',quantity:3,threshold:10,status:'Low'},{name:'Canvas Tote — Natural',quantity:0,threshold:8,status:'Out of stock'},{name:'Ribbed Tank — Charcoal / S',quantity:5,threshold:12,status:'Low'},{name:'Linen Shirt — Olive / L',quantity:2,threshold:8,status:'Low'}], recentActivity: [{type:'sale',title:'New sale completed',time:'2 minutes ago',icon:'↗'},{type:'stock',title:'Inventory restock recorded',time:'28 minutes ago',icon:'□'},{type:'camera',title:'CCTV event: Front entrance',time:'1 hour ago',icon:'◉'},{type:'staff',title:'Staff clocked in',time:'2 hours ago',icon:'◌'}], meta:{ generatedAt: new Date().toISOString(), timezone:'Asia/Manila', businessName:'Aurelia Retail Co.' } };
const api = import.meta.env.VITE_API_BASE_URL;
// Demonstration fixtures must never be available in a Vercel production
// bundle, even if a deployment environment variable is set incorrectly.
const useMockData = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_DATA === 'true';
export type ExportReport = 'overview' | 'sales' | 'inventory' | 'customers' | 'suppliers' | 'operations';
export type SmartPlusNotification = {
  id: string;
  source: 'SmartPlus';
  actionType: string;
  title: string;
  status: 'draft' | 'approved';
  createdAt: string;
  updatedAt: string;
};
export type SmartPlusNotifications = { notifications: SmartPlusNotification[]; unreadCount: number };

function authorizationHeader(): HeadersInit {
  const token = sessionStorage.getItem('analytics_token');
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return { Authorization: `Bearer ${token}` };
}

async function apiFailure(response: Response, fallback: string): Promise<never> {
  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem('analytics_token');
    throw new Error('Your analytics session has expired or is no longer authorized. Please sign in again.');
  }
  const body = await response.json().catch(() => ({}));
  throw new Error(body.message || fallback);
}

export async function getOverview(range: Range): Promise<Overview> {
  if (useMockData) return mock;
  if (!api) throw new Error('The dashboard API URL has not been configured.');
  const res = await fetch(`${api}/analytics/overview?${new URLSearchParams(range)}`, { headers: authorizationHeader() });
  if (!res.ok) return apiFailure(res, 'We could not load the latest dashboard data.');
  const body = await res.json();
  if (body.meta?.businessName) sessionStorage.setItem('analytics_business_name', body.meta.businessName);
  return { ...body.data, meta: body.meta };
}

export async function getAnalyticsDetail(path: string, range: Range): Promise<unknown> {
  if (useMockData) return null;
  if (!api) throw new Error('The dashboard API URL has not been configured.');
  const response = await fetch(`${api}/analytics${path}?${new URLSearchParams(range)}`, {
    headers: authorizationHeader(),
  });
  if (!response.ok) return apiFailure(response, 'We could not load the latest analytics data.');
  const body = await response.json();
  return body.data;
}

/** Returns notification-safe SmartPlus owner suggestions for the signed-in business. */
export async function getSmartPlusNotifications(): Promise<SmartPlusNotifications> {
  if (useMockData) return { notifications: [], unreadCount: 0 };
  if (!api) throw new Error('The dashboard API URL has not been configured.');
  const response = await fetch(`${api}/analytics/notifications`, { headers: authorizationHeader() });
  if (!response.ok) return apiFailure(response, 'We could not load SmartPlus notifications.');
  const body = await response.json();
  return body.data;
}

/** Downloads a tenant-scoped CSV produced by the Smart Monitoring API. */
export async function downloadAnalyticsCsv(report: ExportReport, range: Range): Promise<{ blob: Blob; filename: string }> {
  if (useMockData) {
    return { blob: new Blob(['Report,Development preview\n'], { type: 'text/csv;charset=utf-8' }), filename: `analytics-${report}.csv` };
  }
  if (!api) throw new Error('The dashboard API URL has not been configured.');
  const query = new URLSearchParams({ ...range, report, format: 'csv' });
  const response = await fetch(`${api}/analytics/export?${query}`, { headers: authorizationHeader() });
  if (!response.ok) return apiFailure(response, 'We could not export this report.');
  const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1]
    || `analytics-${report}-${range.from}-to-${range.to}.csv`;
  return { blob: await response.blob(), filename };
}
