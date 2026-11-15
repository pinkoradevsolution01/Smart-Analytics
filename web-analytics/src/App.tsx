import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, CalendarDays, ChevronDown, Cloud, CloudOff, Download, LayoutDashboard, Menu, Package, RefreshCw, Settings, ShoppingBag, Truck, Users, Wrench, X, LogOut } from 'lucide-react';
import { downloadAnalyticsCsv, getAnalyticsDetail, getOverview, getSmartPlusNotifications, type ExportReport, type Overview, type Range } from './api/analytics';
import { KpiCard } from './components/KpiCard';
import { DateRangePicker } from './components/DateRangePicker';
import { completeGoogleSignIn, startGoogleSignIn } from './api/auth';

const nav = [{to:'/',label:'Overview',icon:LayoutDashboard},{to:'/sales',label:'Sales',icon:ShoppingBag},{to:'/inventory',label:'Inventory',icon:Package},{to:'/customers',label:'Customers',icon:Users},{to:'/suppliers',label:'Suppliers',icon:Truck},{to:'/operations',label:'Operations',icon:Wrench}];
// Match the Flutter application's shared Philippine-peso display format.
const peso = new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
function Sidebar({open,setOpen,businessName}:{open:boolean;setOpen:(v:boolean)=>void;businessName:string}) { return <aside className={open?'sidebar open':'sidebar'}><div className="brand"><img className="brand-logo" src="/brand-logo.png" alt="Smart Monitoring Analytics"/><span>Smart<span>Monitor</span></span><button className="close" onClick={()=>setOpen(false)}><X size={20}/></button></div><div className="workspace"><small>WORKSPACE</small><button>{businessName}<ChevronDown size={15}/></button></div><nav>{nav.map(({to,label,icon:Icon})=><NavLink end={to==='/' } to={to} key={to} onClick={()=>setOpen(false)}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-bottom"><NavLink to="/settings"><Settings size={19}/>Settings</NavLink><button onClick={()=>{sessionStorage.removeItem('analytics_token');sessionStorage.removeItem('analytics_user_full_name');sessionStorage.removeItem('analytics_user_email');sessionStorage.removeItem('analytics_business_name');location.href='/login';}}><LogOut size={19}/>Log out</button><div className="sync-note"><span></span><div><b>Synced data</b><small>Updates after Flutter sync</small></div></div></div></aside> }
function Header({onMenu,range,setRange,refreshing}:{onMenu:()=>void;range:Range;setRange:(r:Range)=>void;refreshing:boolean}) {
  const userName=sessionStorage.getItem('analytics_user_full_name')||sessionStorage.getItem('analytics_user_email')||'Smart Monitoring user';
  const initials=userName.split(/\s+|@/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'SM';
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const notifications=useQuery({queryKey:['smartplus-notifications'],queryFn:getSmartPlusNotifications,staleTime:15_000,refetchInterval:30_000});
  const notificationError=notifications.error instanceof Error?notifications.error.message:'Unable to load SmartPlus suggestions.';
  return <header>
    <button className="hamburger" onClick={onMenu} aria-label="Open navigation"><Menu/></button>
    <div className="headline"><p>Good morning, {userName}</p><h1>Business overview</h1></div>
    <div className="header-actions">
      <DateRangePicker range={range} onChange={setRange}/>
      <button className="refresh" title="Refresh data" aria-label="Refresh data" onClick={()=>setRange({...range})}><RefreshCw className={refreshing?'spin':''} size={18}/></button>
      <div className="notification-wrap">
        <button className="notification" aria-label="SmartPlus notifications" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(value=>!value)}><Bell size={19}/>{(notifications.data?.unreadCount||0)>0&&<i/>}</button>
        {notificationsOpen&&<section className="notification-menu" aria-label="SmartPlus suggestions">
          <div><strong>SmartPlus suggestions</strong><small>For your business only</small></div>
          {notifications.isLoading&&<p>Loading suggestions…</p>}
          {notifications.isError&&<p className="notification-error">{notificationError}</p>}
          {!notifications.isLoading&&!notifications.isError&&!(notifications.data?.notifications.length)&&<p>No active SmartPlus suggestions.</p>}
          {notifications.data?.notifications.map(item=><article key={item.id}><span className={`notification-status ${item.level}`}></span><div><b>{item.title}</b><small>{item.message}</small></div><em>{item.level}</em></article>)}
        </section>}
      </div>
      <div className="avatar" title={userName}>{initials}</div>
    </div>
  </header>
}
function Panel({title,subtitle,children,action}:{title:string;subtitle?:string;children:React.ReactNode;action?:React.ReactNode}) { return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section> }
type AnalyticsRow = Record<string, unknown>;
function recordFilterValue(path: string, row: AnalyticsRow) {
  if (path === '/inventory') {
    const quantity=Number(row.quantity || 0);
    const threshold=Number(row.low_stock_threshold || 0);
    return quantity <= 0 ? 'Out of stock' : quantity <= threshold ? 'Low stock' : 'In stock';
  }
  if (path === '/customers' || path === '/suppliers') return Number(row.is_active ?? 1) === 1 ? 'Active' : 'Inactive';
  if (path === '/operations') return String(row.recordType || 'Other');
  return String(row.status || 'Unknown').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function displayCell(column: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (['total_amount','subtotal','discount','amount','selling_price','buying_price','total_value','unit_price'].includes(column)) return peso.format(Number(value));
  if (column === 'is_active') return Number(value) === 1 ? 'Active' : 'Inactive';
  if (/(^|_)(created_at|updated_at|datetime|date|expected_delivery_date)$/.test(column)) {
    const date=new Date(String(value).replace(' ','T'));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
  }
  return String(value).replace(/_/g, ' ');
}
function OperationalDataTable({path,title,rows,columns}:{path:string;title:string;rows:AnalyticsRow[];columns:string[]}) {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All');
  useEffect(()=>{setSearch('');setFilter('All');},[path]);
  const choices=Array.from(new Set(rows.map((row)=>recordFilterValue(path,row)))).sort((a,b)=>a.localeCompare(b));
  const normalizedSearch=search.trim().toLowerCase();
  const filteredRows=rows.filter((row)=>{
    const matchesFilter=filter==='All'||recordFilterValue(path,row)===filter;
    const matchesSearch=!normalizedSearch||columns.some((column)=>String(row[column] ?? '').toLowerCase().includes(normalizedSearch));
    return matchesFilter&&matchesSearch;
  });
  const filterLabel=path==='/sales'?'Sale status':path==='/inventory'?'Stock level':path==='/customers'?'Customer status':path==='/suppliers'?'Supplier status':'Operation type';
  return <>
    <div className="detail-intro"><h2>{title}</h2><p>Live, tenant-scoped records from Smart Monitoring Operations.</p></div>
    <Panel title="Filtered records" subtitle="Search and filter records without changing your source data">
      <div className="table-toolbar">
        <label className="table-search"><span>Search records</span><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title.toLowerCase()} records`}/></label>
        <label className="table-filter"><span>{filterLabel}</span><select value={filter} onChange={(event)=>setFilter(event.target.value)} aria-label={filterLabel}><option value="All">All records</option>{choices.map((choice)=><option key={choice} value={choice}>{choice}</option>)}</select></label>
        <p className="table-count" aria-live="polite"><b>{filteredRows.length}</b> of {rows.length} records</p>
      </div>
      <div className="table-wrap operational-table-wrap"><table><thead><tr>{columns.map((column)=><th key={column}>{column.replace(/_/g,' ')}</th>)}</tr></thead><tbody>{filteredRows.length ? filteredRows.map((row,index)=><tr key={String(row.id || `${path}-${index}`)}>{columns.map((column)=><td key={column}>{['status','is_active'].includes(column)?<span className="status-pill">{displayCell(column,row[column])}</span>:displayCell(column,row[column])}</td>)}</tr>) : <tr><td colSpan={Math.max(columns.length,1)} className="no-results">No records match the current search and filter.</td></tr>}</tbody></table></div>
    </Panel>
  </>;
}
function formatPaymentName(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  const labels: Record<string, string> = {
    cash: 'Cash',
    gcash: 'GCash',
    'online bank': 'Online bank',
    'cash in': 'Cash-in',
    'store damage payment': 'Damage payment',
  };
  return labels[normalized] || normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatChartDate(value: string, index: number, length: number) {
  const every = Math.max(1, Math.ceil(length / 5));
  if (index !== 0 && index !== length - 1 && index % every !== 0) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
function compactPeso(value: number) {
  const amount=Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `₱${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `₱${(amount / 1000).toFixed(0)}k`;
  return peso.format(amount).replace('.00','');
}
function OverviewPage({data}:{data:Overview}) {
  const k=data.kpis;
  const health=data.dataHealth;
  const paymentTotal=data.payments.reduce((sum,payment)=>sum+Number(payment.value || 0),0);
  const paymentColors=['#0d9488','#3b82f6','#f59e0b','#8b5cf6','#e35d6a','#64748b'];
  const payments=data.payments.map((payment,index)=>({
    ...payment,
    color:payment.color || paymentColors[index % paymentColors.length],
    label:formatPaymentName(payment.name),
    amount:Number(payment.value || 0),
    share:paymentTotal > 0 ? (Number(payment.value || 0) / paymentTotal) * 100 : 0,
  }));
  const maxUnits=Math.max(...data.topProducts.map((product)=>Number(product.sold || 0)),1);
  const salesSeries=[...data.salesSeries].map((point)=>({
    ...point,
    date:String(point.date).slice(0,10),
    net:Number(point.net || 0),
  })).filter((point)=>Number.isFinite(point.net)).sort((left,right)=>left.date.localeCompare(right.date));
  const comparisonSubtitle=`Compared with ${new Date(`${data.comparisons.previousPeriod.from}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric'})} – ${new Date(`${data.comparisons.previousPeriod.to}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}`;
  const syncText=health.lastSuccessfulSync ? new Date(String(health.lastSuccessfulSync).replace(' ','T')).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}) : 'No successful Smart Monitoring sync recorded yet';
  return <>
    <section className={`data-health ${health.status}`} aria-label="Data health">
      <span className="health-icon">{health.status==='synced'?<Cloud size={19}/>:<CloudOff size={19}/>}</span>
      <div><strong>{health.status==='synced'?'Smart Monitoring data is synced':'Waiting for a Smart Monitoring sync'}</strong><p>{health.status==='synced'?`Last successful sync: ${syncText}`:'Open Smart Monitoring and run Cloud Sync to populate this dashboard.'}</p></div>
      {health.lastFailedSync&&<small>Last sync issue: {new Date(String(health.lastFailedSync).replace(' ','T')).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</small>}
    </section>
    <p className="comparison-caption">{comparisonSubtitle}</p>
    <div className="kpis">
      <KpiCard label="Net sales" value={peso.format(k.netSales)} change={data.comparisons.netSales}/>
      <KpiCard label="Transactions" value={k.transactions.toString()} change={data.comparisons.transactions}/>
      <KpiCard label="Average order value" value={peso.format(k.averageOrderValue)} change={data.comparisons.averageOrderValue}/>
      <KpiCard label="Low stock items" value={k.lowStockCount.toString()} helper="Needs attention" tone="warning"/>
    </div>
    <div className="grid-main"><Panel title="Sales performance" subtitle="Net sales over selected period" action={<NavLink className="text-button" to="/sales">View report <span aria-hidden="true">→</span></NavLink>}><div className="chart"><ResponsiveContainer><AreaChart data={data.salesSeries}><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={.24}/><stop offset="95%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis hide/><Tooltip formatter={(v)=>peso.format(Number(v))}/><Area type="monotone" dataKey="net" stroke="#0f766e" strokeWidth={2.5} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div><div className="chart-summary"><span><b>{peso.format(k.netSales)}</b> net sales</span><span><b>{k.transactions}</b> transactions</span><span><b>{k.itemsSold}</b> items sold</span></div></Panel><Panel title="Payment mix" subtitle="By completed sale"><div className="payment"><ResponsiveContainer width="48%" height={205}><PieChart><Pie data={data.payments} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={4}>{data.payments.map(p=><Cell key={p.name} fill={p.color}/>)}</Pie><Tooltip formatter={(v)=>`${v}%`}/></PieChart></ResponsiveContainer><div>{data.payments.map(p=><div className="legend" key={p.name}><i style={{background:p.color}}></i><span>{p.name}</span><b>{p.value}%</b></div>)}</div></div></Panel></div>
    <div className="grid-bottom"><Panel title="Top products" subtitle="By units sold" action={<NavLink className="text-button" to="/sales">View sales <span aria-hidden="true">→</span></NavLink>}><ResponsiveContainer width="100%" height={210}><BarChart data={data.topProducts} layout="vertical" margin={{left:25}}><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={135} tickLine={false} axisLine={false}/><Tooltip formatter={(v)=>`${v} units`}/><Bar dataKey="sold" fill="#0d9488" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></Panel><Panel title="Stock attention" subtitle="Products needing action" action={<NavLink className="text-button" to="/inventory">Open inventory <span aria-hidden="true">→</span></NavLink>}><div className="stock-list">{data.lowStock.map(p=><div key={p.name}><span className={p.status==='Out of stock'?'stock-dot out':'stock-dot'}></span><p><b>{p.name}</b><small>{p.quantity} on hand · threshold {p.threshold}</small></p><em className={p.status==='Out of stock'?'out':''}>{p.status}</em></div>)}</div></Panel><Panel title="Recent activity" subtitle="From Smart Monitoring sync"><div className="activity-list">{data.recentActivity.length?data.recentActivity.map(a=><div key={`${a.type}-${a.time}-${a.title}`}><span className={'activity-icon '+a.type}>{a.icon}</span><p><b>{a.title}</b><small>{new Date(String(a.time).replace(' ','T')).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</small></p></div>):<p className="empty-activity">No synced activity in this business yet.</p>}</div></Panel></div>
    <div className="overview-primary">
      <Panel title="Sales performance" subtitle="Net sales across the selected period" action={<NavLink className="text-button" to="/sales">View report <span aria-hidden="true">→</span></NavLink>}>
        <div className="chart overview-sales-chart">{salesSeries.length?<ResponsiveContainer><AreaChart data={salesSeries} margin={{top:12,right:16,left:8,bottom:2}}><defs><linearGradient id="analytics-sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={.24}/><stop offset="95%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(value,index)=>formatChartDate(String(value),index,salesSeries.length)}/><YAxis width={68} tickLine={false} axisLine={false} domain={[0,'auto']} tickFormatter={(value)=>compactPeso(Number(value))}/><Tooltip formatter={(value)=>peso.format(Number(value))} labelFormatter={(label)=>formatChartDate(String(label),0,1)}/><Area connectNulls type="monotone" dataKey="net" stroke="#0f766e" strokeWidth={2.5} fill="url(#analytics-sales-fill)"/></AreaChart></ResponsiveContainer>:<p className="chart-empty">No completed sales are available in this date range.</p>}</div>
        <div className="chart-summary"><span><b>{peso.format(k.netSales)}</b> net sales</span><span><b>{k.transactions}</b> transactions</span><span><b>{k.itemsSold}</b> items sold</span></div>
      </Panel>
      <Panel title="Payment mix" subtitle="Completed-sale revenue by payment method"><div className="payment payment-improved"><ResponsiveContainer width="43%" height={205}><PieChart><Pie data={payments} dataKey="amount" innerRadius={55} outerRadius={76} paddingAngle={3}>{payments.map(p=><Cell key={p.name} fill={p.color}/>)}</Pie><Tooltip formatter={(value)=>peso.format(Number(value))}/></PieChart></ResponsiveContainer><div className="payment-legend">{payments.length?payments.map(p=><div className="legend" key={p.name}><i style={{background:p.color}}></i><span title={p.label}>{p.label}</span><div><b>{peso.format(p.amount)}</b><small>{p.share.toFixed(1)}%</small></div></div>):<p className="empty-activity">No completed payments in this period.</p>}</div></div></Panel>
    </div>
    <div className="overview-top-products"><Panel title="Top products" subtitle="Ranked by units sold" action={<NavLink className="text-button" to="/sales">View sales <span aria-hidden="true">→</span></NavLink>}><ol className="top-products">{data.topProducts.length?data.topProducts.slice(0,6).map((product,index)=><li key={`${product.name}-${index}`}><span className="product-rank">{index+1}</span><div className="product-detail"><div><b title={product.name}>{product.name}</b><strong>{product.sold} units</strong></div><span><i style={{width:`${(Number(product.sold || 0)/maxUnits)*100}%`}}></i></span><small>{peso.format(Number(product.revenue || 0))} sales</small></div></li>):<p className="empty-activity">No product sales in this period.</p>}</ol></Panel></div>
    <div className="overview-secondary">
      <Panel title="Top products" subtitle="Ranked by units sold" action={<NavLink className="text-button" to="/sales">View sales <span aria-hidden="true">→</span></NavLink>}><ol className="top-products">{data.topProducts.length?data.topProducts.slice(0,6).map((product,index)=><li key={`${product.name}-${index}`}><span className="product-rank">{index+1}</span><div className="product-detail"><div><b title={product.name}>{product.name}</b><strong>{product.sold} units</strong></div><span><i style={{width:`${(Number(product.sold || 0)/maxUnits)*100}%`}}></i></span><small>{peso.format(Number(product.revenue || 0))} sales</small></div></li>):<p className="empty-activity">No product sales in this period.</p>}</ol></Panel>
      <Panel title="Stock attention" subtitle="Products needing action" action={<NavLink className="text-button" to="/inventory">Open inventory <span aria-hidden="true">→</span></NavLink>}><div className="stock-list">{data.lowStock.length?data.lowStock.map(p=><div key={p.name}><span className={p.status==='Out of stock'?'stock-dot out':'stock-dot'}></span><p><b>{p.name}</b><small>{p.quantity} on hand · threshold {p.threshold}</small></p><em className={p.status==='Out of stock'?'out':''}>{p.status}</em></div>):<p className="empty-activity">No low-stock products in this period.</p>}</div></Panel>
      <Panel title="Recent activity" subtitle="From Smart Monitoring sync"><div className="activity-list">{data.recentActivity.length?data.recentActivity.slice(0,6).map(a=><div key={`${a.type}-${a.time}-${a.title}`}><span className={'activity-icon '+a.type}>{a.icon}</span><p><b>{a.title}</b><small>{new Date(String(a.time).replace(' ','T')).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</small></p></div>):<p className="empty-activity">No synced activity in this business yet.</p>}</div></Panel>
    </div>
  </>
}
const details: Record<string, { description: string; metrics: [string, string][]; columns: string[]; rows: string[][] }> = {
  '/sales': { description: 'Completed sales only · filters are applied by the analytics API', metrics: [['Gross sales', '₱142,800'], ['Completed sales', '429'], ['Cancelled', '18'], ['Items per order', '1.9']], columns: ['Transaction', 'Date & time', 'Payment', 'Cashier', 'Total', 'Status'], rows: [['#SM-10429', 'Aug 20, 10:42 AM', 'GCash', 'Maria Santos', '₱1,680', 'Completed'], ['#SM-10428', 'Aug 20, 10:21 AM', 'Cash', 'John Reyes', '₱850', 'Completed'], ['#SM-10427', 'Aug 20, 9:56 AM', 'Card', 'Maria Santos', '₱2,450', 'Completed']] },
  '/inventory': { description: 'Stock status and movement records from the latest central sync', metrics: [['On-hand units', '2,846'], ['Cost value', '₱468,200'], ['Retail value', '₱814,300'], ['Out of stock', '4']], columns: ['Product', 'Category', 'On hand', 'Threshold', 'Cost value', 'Status'], rows: [['Classic Crew Tee — White / M', 'Tops', '3', '10', '₱750', 'Low'], ['Canvas Tote — Natural', 'Accessories', '0', '8', '₱0', 'Out of stock'], ['Linen Shirt — Olive / L', 'Tops', '2', '8', '₱1,100', 'Low']] },
  '/customers': { description: 'Aggregate charts omit PII; detailed records require an authorized role', metrics: [['Active customers', '292'], ['New customers', '47'], ['Repeat rate', '38.4%'], ['Loyalty points issued', '8,460']], columns: ['Customer', 'Joined', 'Orders', 'Loyalty balance', 'Lifetime points', 'Status'], rows: [['Customer #C-1924', 'Aug 19, 2026', '4', '290', '810', 'Active'], ['Customer #C-1876', 'Aug 17, 2026', '2', '120', '340', 'Active'], ['Customer #C-1623', 'Aug 04, 2026', '8', '640', '1,980', 'Active']] },
  '/suppliers': { description: 'Supplier and purchase-order records from your assigned business', metrics: [['Active suppliers', '—'], ['Purchase orders', '—'], ['Open orders', '—'], ['Ordered value', '—']], columns: ['Supplier', 'Contact', 'Purchase orders', 'Open orders', 'Last order', 'Status'], rows: [] },
  '/operations': { description: 'Attendance, purchasing, supplier, and damage-report activity', metrics: [['Attendance entries', '74'], ['Purchase orders', '12'], ['Supplier activity', '8'], ['Damage reports', '5']], columns: ['Activity', 'Reference', 'Date', 'Owner', 'Amount / Qty', 'Status'], rows: [['Purchase order', 'PO-2026-0820', 'Aug 20, 2026', 'Aurelia Supplies', '₱28,400', 'Received'], ['Damage report', 'DR-2026-0819', 'Aug 19, 2026', 'Maria Santos', '3 units', 'Open'], ['Attendance', 'Clock-in', 'Aug 20, 2026', 'John Reyes', '8:02 AM', 'Recorded']] },
  '/settings': { description: 'Business-level reporting preferences', metrics: [['Timezone', 'Asia/Manila'], ['Currency', 'PHP'], ['Refresh policy', 'Manual'], ['Role', 'Owner']], columns: ['Preference', 'Current value', 'Source', 'Updated', 'Scope', 'State'], rows: [['Reporting timezone', 'Asia/Manila', 'Business defaults', 'Aug 01, 2026', 'Business', 'Active'], ['Currency display', 'PHP · en-PH', 'Business defaults', 'Aug 01, 2026', 'Business', 'Active']] }
};
const themes=[['Professional Black','#212121'],['Pastel Sage','#5c8176'],['Pastel Blue','#627f9f'],['Dusty Lavender','#776f98'],['Muted Rose','#926d78'],['Warm Sand','#8d735f'],['Soft Teal','#4d8980'],['Misty Indigo','#68769a'],['Apricot Clay','#a27661'],['Eucalyptus','#607f68']] as const;
function ThemePicker(){const [current,setCurrent]=useState(localStorage.getItem('analytics_theme')||'#212121');const choose=(color:string)=>{localStorage.setItem('analytics_theme',color);document.documentElement.style.setProperty('--theme-primary',color);setCurrent(color)};return <Panel title="Theme preset" subtitle="Applies to the sidebar and application header"><div className="theme-picker">{themes.map(([name,color])=><button key={name} className={`theme-choice ${current===color?'active':''}`} onClick={()=>choose(color)}><i className="theme-swatch" style={{background:color}}></i>{name}</button>)}</div></Panel>}
function AnalyticsSettings(){return <><div className="detail-intro"><h2>Settings</h2><p>Analytics uses your signed-in Smart Monitoring business account.</p></div><ThemePicker/><Panel title="Data connection" subtitle="Protected Smart Monitoring API"><div className="state"><b>Tenant-scoped analytics</b><p>Business data is loaded only after your verified Smart Monitoring session is accepted. This site does not store a database connection, backend secret, or selectable business ID.</p></div></Panel></>}
function DetailPage({path}:{path:string}) { const detail=details[path] ?? details['/sales']; return <><div className="detail-intro"><h2>{path.slice(1).replace(/^./, c=>c.toUpperCase())}</h2><p>{detail.description}</p></div><div className="kpis detail-kpis">{detail.metrics.map(([label,value])=><KpiCard key={label} label={label} value={value}/>)}</div>{path==='/settings'&&<ThemePicker/>}<Panel title="Filtered records" subtitle="Use the date selector above to request a different reporting period"><div className="table-wrap"><table><thead><tr>{detail.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{detail.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{j===row.length-1?<span className="status-pill">{cell}</span>:cell}</td>)}</tr>)}</tbody></table></div><div className="table-footer"><span>Showing {detail.rows.length} recent records</span><button className="text-button">Previous</button><button className="text-button">Next</button></div></Panel></> }
function LiveDetailPage({path,range}:{path:string;range:Range}) {
  const query = useQuery({ queryKey: ['analytics-detail', path, range], queryFn: () => getAnalyticsDetail(path, range) });
  if (path === '/settings') return <AnalyticsSettings/>;
  if (query.isLoading) return <div className="state">Loading your operational data…</div>;
  if (query.isError) return <div className="state error">{query.error.message} <button onClick={()=>query.refetch()}>Try again</button></div>;
  const payload = query.data as any;
  const rows = path === '/inventory' ? payload?.products || []
    : path === '/customers' ? payload?.customers || []
    : path === '/suppliers' ? payload?.suppliers || []
    : path === '/operations' ? [...(payload?.attendanceEntries || []).map((item:any)=>({recordType:'Attendance',...item})), ...(payload?.inventoryMovements || []).map((item:any)=>({recordType:'Inventory movement',...item})), ...(payload?.purchaseOrders || []).map((item:any)=>({recordType:'Purchase order',...item})), ...(payload?.damageReports || []).map((item:any)=>({recordType:'Damage report',...item}))]
    : Array.isArray(payload) ? payload : [];
  const columns = rows.length ? Array.from(new Set(rows.flatMap((row:any)=>Object.keys(row)))).filter((key) => !['business_id', 'password', 'password_hash'].includes(key)) : [];
  const title = path.slice(1).replace(/^./, (letter) => letter.toUpperCase());
  return <OperationalDataTable path={path} title={title} rows={rows} columns={columns}/>;
}
function Dashboard() {
  if (!sessionStorage.getItem('analytics_token')) return <Navigate to="/login" replace/>;
  const [open,setOpen]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState('');
  const [range,setRange]=useState<Range>({from:new Date(Date.now()-29*864e5).toISOString().slice(0,10),to:new Date().toISOString().slice(0,10)});
  const q=useQuery({queryKey:['overview',range],queryFn:()=>getOverview(range)});
  const location=useLocation();
  const download=async()=>{
    const report=(location.pathname==='/'?'overview':location.pathname.slice(1)) as ExportReport;
    setExporting(true);setExportError('');
    try { const {blob,filename}=await downloadAnalyticsCsv(report,range);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url); }
    catch(reason){setExportError(reason instanceof Error?reason.message:'We could not export this report.');}
    finally{setExporting(false);}
  };
  return <div className="app"><Sidebar open={open} setOpen={setOpen} businessName={q.data?.meta.businessName || sessionStorage.getItem('analytics_business_name') || 'Your business'}/><main><Header onMenu={()=>setOpen(true)} range={range} setRange={setRange} refreshing={q.isFetching}/><div className="content"><div className="content-top"><div><span className="eyebrow">{location.pathname==='/'?'REPORTING · LAST 30 DAYS':'ANALYTICS'}</span>{location.pathname==='/'&&<p className="sync">Centralized data · Last refreshed {q.data ? new Date(q.data.meta.generatedAt).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}) : '—'} · Asia/Manila</p>}{exportError&&<p className="export-error" role="alert">{exportError}</p>}</div><button className="export" onClick={download} disabled={exporting}><Download size={16}/>{exporting?'Preparing CSV...':'Export CSV'}</button></div>{q.isLoading&&<div className="state">Loading your operational data…</div>}{q.isError&&<div className="state error">{q.error.message} <button onClick={()=>q.refetch()}>Try again</button></div>}{location.pathname==='/'&&q.data&&<OverviewPage data={q.data}/>} {location.pathname!=='/'&&<LiveDetailPage path={location.pathname} range={range}/>}</div></main></div>
}
function Login(){
  const [error,setError]=useState('');
  const [googleLoading,setGoogleLoading]=useState(false);
  const loginSurfaceRef=useRef<HTMLDivElement>(null);
  const googleLogin=()=>{setError('');setGoogleLoading(true);try{startGoogleSignIn()}catch(reason){setGoogleLoading(false);setError(reason instanceof Error?reason.message:'Unable to start Google sign-in.')}};
  const revealBackground=(event:PointerEvent<HTMLDivElement>)=>{
    if(event.pointerType!=='mouse') return;
    const surface=loginSurfaceRef.current;
    if(!surface) return;
    const bounds=surface.getBoundingClientRect();
    surface.style.setProperty('--login-pointer-x',`${event.clientX-bounds.left}px`);
    surface.style.setProperty('--login-pointer-y',`${event.clientY-bounds.top}px`);
    surface.classList.add('is-revealing');
  };
  const hideBackgroundReveal=()=>loginSurfaceRef.current?.classList.remove('is-revealing');
  return <div ref={loginSurfaceRef} className="login login-retail" onPointerMove={revealBackground} onPointerLeave={hideBackgroundReveal}>
    <span className="login-background-reveal" aria-hidden="true"/>
    <div className="login-card"><img className="brand-logo" src="/brand-logo.png" alt="Smart Monitoring Analytics"/><h1>Welcome back</h1><p>Sign in with your authorized Smart Monitoring Google account to access your business analytics.</p><button type="button" className="google-button" onClick={googleLogin} disabled={googleLoading}><span className="google-g" aria-hidden="true">G</span>{googleLoading?'Opening Google...':'Continue with Google'}</button>{error&&<p className="login-error" role="alert">{error}</p>}<small>Your data is scoped to your assigned business.</small></div>
  </div>
}
function GoogleCallback(){const navigate=useNavigate();const location=useLocation();const [error,setError]=useState('');const started=useRef(false);useEffect(()=>{if(started.current)return;started.current=true;const params=new URLSearchParams(location.search);const code=params.get('code');const providerError=params.get('error_description')||params.get('error');if(providerError){setError(providerError);return}if(!code){setError('Google sign-in did not return a completion code. Please try again.');return}(async()=>{try{const token=await completeGoogleSignIn(code);sessionStorage.setItem('analytics_token',token);navigate('/',{replace:true})}catch(reason){setError(reason instanceof Error?reason.message:'Google sign-in could not be completed.')}})()},[location.search,navigate]);return <div className="login"><div><img className="brand-logo" src="/brand-logo.png" alt="Smart Monitoring Analytics"/><h1>Signing you in</h1>{error?<><p className="login-error">{error}</p><button className="login-link" onClick={()=>navigate('/login',{replace:true})}>Return to sign in</button></>:<p>We are securely confirming your Smart Monitoring account.</p>}</div></div>}
export default function App(){return <Routes><Route path="/login" element={<Login/>}/><Route path="/auth/google/callback" element={<GoogleCallback/>}/><Route path="/cctv-events" element={<Navigate to="/" replace/>}/><Route path="/*" element={<Dashboard/>}/><Route path="*" element={<Navigate to="/"/>}/></Routes>}
