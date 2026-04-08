/**
 * 本地/部署用 Worker 地址（无末尾斜杠）。
 * 在 cloud/worker 执行 npx wrangler deploy 后，把下一行改成控制台里显示的 workers.dev 地址。
 * 留空则可在「云快照上传/查看」页面手动填写；本机上次输入的地址仍会存在 localStorage。
 */
// Worker 完整域名 = Worker 名 + 账户子域：{name}.{subdomain}.workers.dev
window.CLOUD_WORKER_BASE = 'https://chaos-world-toolkit-snapshot.heiheiheiha.workers.dev';
