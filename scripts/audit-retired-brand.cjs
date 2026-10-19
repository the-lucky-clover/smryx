// Audit current source, bundles, UTF-16 resources, and ZIP contents without
// modifying repository history, dependencies, or editor metadata.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const retired = String.fromCharCode(99, 97, 108, 109, 97, 105);
const excluded = new Set(['.git','node_modules','.publish-sumyst','.agents','.codex','.kilo','.wrangler','test-results','playwright-report']);
const textTypes = /\.(?:js|cjs|mjs|json|jsonc|map|html?|css|svg|md|txt|xml|plist|swift|sh|ps1|py|ya?ml|toml|xcconfig|entitlements|pbxproj|xcworkspacedata)$/i;

function decodedText(text) {
  for (let pass=0;pass<4;pass++) {
    const next=text.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})|%([0-9a-f]{2})|&#x([0-9a-f]+);|&#(\d+);/gi,
    (match,u,unit,hex,percent,entity,decimal) => {
      const code = decimal ? Number(decimal) : parseInt(u||unit||hex||percent||entity,16);
      return code<=0x10ffff ? String.fromCodePoint(code) : match;
    }).replace(/["'`]\s*\+\s*["'`]/g,'');
    if(next===text)break;
    text=next;
  }
  return text;
}
function inspect(bytes, isText = true) {
  if (bytes.toString('latin1').toLowerCase().includes(retired)) return 'literal';
  if (bytes.length>=2 && bytes.toString('utf16le').toLowerCase().includes(retired)) return 'UTF-16';
  if(bytes[0]===0xfe&&bytes[1]===0xff&&Buffer.from(bytes.subarray(0,bytes.length-bytes.length%2)).swap16().toString('utf16le').toLowerCase().includes(retired))return 'UTF-16';
  if (!isText) return null;
  const text=decodedText(bytes.toString('utf8'));
  if(text.toLowerCase().includes(retired)) return 'escaped or joined string';
  for(const match of text.matchAll(/[A-Za-z0-9+/_-]{8,}={0,2}/g)) {
    if(match[0].length>1000000)continue;
    const candidate=Buffer.from(match[0],'base64').toString('utf8');
    if(decodedText(candidate).toLowerCase().includes(retired))return 'base64';
  }
  return null;
}
function zipEntries(bytes) {
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw Error('ZIP directory not found');
  const entries=[],count=bytes.readUInt16LE(end+10);
  let offset=bytes.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    if(bytes.readUInt32LE(offset)!==0x02014b50)throw Error('Invalid ZIP entry');
    const method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+20),expanded=bytes.readUInt32LE(offset+24),nameSize=bytes.readUInt16LE(offset+28),extraSize=bytes.readUInt16LE(offset+30),commentSize=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
    const name=bytes.subarray(offset+46,offset+46+nameSize).toString('utf8');
    if(expanded>50000000)throw Error('ZIP entry exceeds audit limit');
    if(bytes.readUInt32LE(local)!==0x04034b50)throw Error('Invalid ZIP local header');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    const compressed=bytes.subarray(start,start+size);
    const content=method===0?compressed:method===8?zlib.inflateRawSync(compressed,{maxOutputLength:50000000}):null;
    if(!content)throw Error('Unsupported ZIP compression');
    entries.push({name,content});
    offset+=46+nameSize+extraSize+commentSize;
  }
  return entries;
}
function audit(root) {
  const report={files:0,archives:0,archiveEntries:0,findings:[],errors:[]};
  function scan(bytes,name){
    const kind=inspect(bytes,textTypes.test(name));
    if(kind)report.findings.push({file:name,encoding:kind});
  }
  function walk(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      if(entry.isSymbolicLink())continue;
      const full=path.join(folder,entry.name),relative=path.relative(root,full).replaceAll('\\','/');
      if(entry.isDirectory()){if(!excluded.has(entry.name))walk(full);continue;}
      report.files++;
      const pathKind=inspect(Buffer.from(relative));
      if(pathKind)report.findings.push({file:relative,encoding:'file path'});
      const bytes=fs.readFileSync(full);scan(bytes,relative);
      if(/\.zip$/i.test(entry.name))try{
        report.archives++;
        for(const item of zipEntries(bytes)){
          report.archiveEntries++;
          if(inspect(Buffer.from(item.name)))report.findings.push({file:relative+'!'+item.name,encoding:'ZIP entry path'});
          scan(item.content,relative+'!'+item.name);
        }
      }catch(error){report.errors.push({file:relative,error:error.message});}
    }
  }
  walk(path.resolve(root));
  return report;
}
if(require.main===module){
  const report=audit(process.argv[2]||path.resolve(__dirname,'..'));
  console.log(JSON.stringify(report,null,2));
  if(report.findings.length||report.errors.length)process.exitCode=1;
}
module.exports={audit,inspect,zipEntries};
