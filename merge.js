const fs = require('fs');
const vars = {};
for (const line of fs.readFileSync('/root/saved-config/tunnel-probe-vars.txt', 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !line.startsWith('#') && !['saas_node', 'upload', 'bot_url', 'UUID_alt'].includes(m[1])) vars[m[1]] = m[2];
}
let src = fs.readFileSync('/root/argo-cfs-deployzy/index.js', 'utf8');

// 1. 更新已存在的变量默认值
const setDef = (k) => {
  const re = new RegExp('const ' + k + ' = process\\.env\\.' + k + ' \\|\\| \'[^\']*\';');
  if (vars[k] && re.test(src)) src = src.replace(re, 'const ' + k + ' = process.env.' + k + ' || \'' + vars[k] + '\';');
};
['UUID', 'ARGO_DOMAIN', 'ARGO_AUTH', 'CFIP', 'CFP_ID', 'CFP_SECRET', 'CFP_URL', 'CFP_CT', 'CFP_CU', 'CFP_CM', 'CFP_BD'].forEach(setDef);

// 2. 删除 NEZHA 变量定义
src = src.replace(/const NEZHA_SERVER = process\.env\.NEZHA_SERVER \|\| '';[\s\S]*?const NEZHA_KEY = process\.env\.NEZHA_KEY \|\| '';\n?/, '');
// 删 npmName/phpName 定义
src = src.replace('const npmName = generateRandomName();\nconst webName = generateRandomName();\nconst botName = generateRandomName();\nconst phpName = generateRandomName();', 'const webName = generateRandomName();\nconst botName = generateRandomName();');
// 删 npmPath/phpPath 定义
src = src.replace('let npmPath = path.join(FILE_PATH, npmName);\nlet phpPath = path.join(FILE_PATH, phpName);\nlet webPath = path.join(FILE_PATH, webName);', 'let webPath = path.join(FILE_PATH, webName);');
// 删 filesToAuthorize 的 NEZHA 分支
src = src.replace('const filesToAuthorize = NEZHA_PORT ? [npmPath, webPath, botPath] : [phpPath, webPath, botPath];', 'const filesToAuthorize = [webPath, botPath, cfPath];');
// 删运行段的 nezha 整块
src = src.replace(/\/\/运行ne-zha[\s\S]*?\n  \} else \{\n    console\.log\('NEZHA variable is empty,skip running'\);\n  \}\n/, '');
// 删下载段的 nezha 分支
src = src.replace(/if \(NEZHA_SERVER && NEZHA_KEY\) \{[\s\S]*?return baseFiles;/, 'return baseFiles;');
// 删 cleanFiles 的 NEZHA 分支
src = src.replace(/    if \(NEZHA_PORT\) \{\n      filesToDelete\.push\(npmPath\);\n    \} else if \(NEZHA_SERVER && NEZHA_KEY\) \{\n      filesToDelete\.push\(phpPath\);\n    \}\n/, '');

// 3. 创建全部探针变量(插入到 NAME 定义前)
const varDefs = [
  ['CFP_ID', vars.CFP_ID || ''], ['CFP_SECRET', vars.CFP_SECRET || ''], ['CFP_URL', vars.CFP_URL || ''],
  ['CFP_COLLECT', '0'], ['CFP_INTERVAL', '60'], ['CFP_CT', vars.CFP_CT || ''], ['CFP_CU', vars.CFP_CU || ''],
  ['CFP_CM', vars.CFP_CM || ''], ['CFP_BD', vars.CFP_BD || ''], ['CFP_NODE1', ''], ['CFP_NODE2', ''],
  ['CFP_NODE3', ''], ['CFP_NODE4', ''], ['CFP_IFACE', ''], ['CFP_RESET_DAY', '1'],
  ['CFP_CONN_MODE', 'auto'], ['CFP_PING_MODE', 'tcp'], ['CFP_DEBUG', '0']
];
let block = '';
for (const [k, d] of varDefs) {
  if (!src.includes('const ' + k + ' = process.env.' + k)) {
    block += 'const ' + k + ' = process.env.' + k + " || '" + d + "';\n";
  }
}
if (block) {
  const marker = 'const NAME = process.env.NAME ||';
  src = src.replace(marker, block + marker);
}

// 4. 下载源替换为 oooen.com
src = src.replace(/arm64\.ssss\.nyc\.mn/g, 'arm64.oooen.com').replace(/amd64\.ssss\.nyc\.mn/g, 'amd64.oooen.com');

// 5. cfName/cfPath/cfpConfPath 定义
if (!src.includes('const cfName = generateRandomName();')) {
  src = src.replace('const botName = generateRandomName();', 'const botName = generateRandomName();\nconst cfName = generateRandomName();');
}
if (!src.includes('let cfPath = path.join(FILE_PATH, cfName);')) {
  src = src.replace('let botPath = path.join(FILE_PATH, botName);', 'let botPath = path.join(FILE_PATH, botName);\nlet cfPath = path.join(FILE_PATH, cfName);');
}
if (!src.includes('let cfpConfPath = path.join(FILE_PATH, \'cfprobe.conf\');')) {
  src = src.replace("let listPath = path.join(FILE_PATH, 'list.txt');", "let listPath = path.join(FILE_PATH, 'list.txt');\nlet cfpConfPath = path.join(FILE_PATH, 'cfprobe.conf');");
}

// 6. 探针下载段
src = src.replace('return baseFiles;', 'if (CFP_ID && CFP_SECRET && CFP_URL) {\n    baseFiles.push({ fileName: cfPath, fileUrl: "https://github.com/huilang-me/cfsm-agent/releases/latest/download/cf-probe-linux-amd64" });\n  }\n  return baseFiles;');

// 7. 探针运行段(插入到 web 运行前)
const webRun = '  // 运行xr-ay\n  const command1 = `nohup ${webPath} -c ${FILE_PATH}/config.json';
const probeRun = `  // 运行cf-probe探针
  if (CFP_ID && CFP_SECRET && CFP_URL) {
    const probeConf = [
      'SERVER_ID="' + CFP_ID + '"', 'SECRET="' + CFP_SECRET + '"', 'WORKER_URL="' + CFP_URL + '"',
      'COLLECT_INTERVAL="' + CFP_COLLECT + '"', 'REPORT_INTERVAL="' + CFP_INTERVAL + '"',
      'CT_NODE="' + CFP_CT + '"', 'CU_NODE="' + CFP_CU + '"', 'CM_NODE="' + CFP_CM + '"', 'BD_NODE="' + CFP_BD + '"',
      'NODE_1="' + CFP_NODE1 + '"', 'NODE_2="' + CFP_NODE2 + '"', 'NODE_3="' + CFP_NODE3 + '"', 'NODE_4="' + CFP_NODE4 + '"',
      'INTERFACE="' + CFP_IFACE + '"', 'RESET_DAY="' + CFP_RESET_DAY + '"', 'CONNECTION_MODE="' + CFP_CONN_MODE + '"', 'PING_MODE="' + CFP_PING_MODE + '"',
      'AUTO_UPDATE="0"', 'CONFIG_MD5="none"'
    ].join('\n');
    fs.writeFileSync(cfpConfPath, probeConf + '\n');
    const debugArg = CFP_DEBUG === '1' ? '-debug=1' : '-debug=0';
    const probeCmd = 'nohup ' + cfPath + ' run -config "' + cfpConfPath + '" ' + debugArg + ' >/dev/null 2>&1 &';
    try { await exec(probeCmd); console.log(cfName + ' is running'); await new Promise(r => setTimeout(r, 1000)); }
    catch (e) { console.error('cf probe running error: ' + e); }
  }

  // 运行xr-ay
  const command1 = \`nohup \${webPath} -c \${FILE_PATH}/config.json`;
src = src.replace(webRun, probeRun);

fs.writeFileSync('/root/argo-cfs-deployzy/index-merged.js', src);
console.log('merged ok; lines=', src.split('\n').length);
console.log('CFP vars created:', varDefs.filter(([k]) => src.includes('const ' + k + ' = process.env.' + k)).length, '/', varDefs.length);
console.log('NEZHA remaining:', (src.match(/NEZHA/g) || []).length);
console.log('CFP defs present:', ['CFP_ID', 'CFP_SECRET', 'CFP_URL'].every(k => src.includes('const ' + k + ' = process.env.' + k)));