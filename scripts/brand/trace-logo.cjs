// Traces the supplied SALEEM logo (white background PNG) into flat-colour SVG paths:
// wordmark (dark forest green) and symbol (bright green), split by the empty column gap.
const ROOT=process.argv[2], SRC=process.argv[3], OUT=process.argv[4];
const {PNG}=require(ROOT+"/node_modules/pngjs");const fs=require("fs");
const p=PNG.sync.read(fs.readFileSync(SRC));const W=p.width,H=p.height;
const SPLIT=908; // gap between wordmark (x<=881) and symbol (x>=935)
// alpha from the red channel (both inks have low red), with a levels curve to drop the soft shadow
function alphaAt(x,y){const r=p.data[(y*W+x)*4];return r}
function grid(x0,x1,ref){const w=x1-x0+3,h=H+2;const g=new Float32Array(w*h);
 for(let y=0;y<H;y++)for(let x=x0;x<=x1;x++){let a=(255-alphaAt(x,y))/(255-ref);a=(a-0.12)/0.76;g[(y+1)*w+(x-x0+1)]=Math.max(0,Math.min(1,a));}
 return {g,w,h,ox:x0-1,oy:-1};}
function stats(x0,x1){let n=0,s=[0,0,0];for(let y=0;y<H;y++)for(let x=x0;x<=x1;x++){const i=(y*W+x)*4;if(p.data[i]<120&&p.data[i+1]<200){n++;s[0]+=p.data[i];s[1]+=p.data[i+1];s[2]+=p.data[i+2]}}return s.map(v=>Math.round(v/n))}
function trace({g,w,h,ox,oy},T=0.5){
 const v=(x,y)=>g[y*w+x];const segs=[];
 const lerp=(a,b)=>(T-a)/(b-a);
 for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
  const a=v(x,y),b=v(x+1,y),c=v(x+1,y+1),d=v(x,y+1);
  const idx=(a>T?8:0)|(b>T?4:0)|(c>T?2:0)|(d>T?1:0);if(idx===0||idx===15)continue;
  const P={t:[`h${x},${y}`,x+lerp(a,b),y],r:[`v${x+1},${y}`,x+1,y+lerp(b,c)],b:[`h${x},${y+1}`,x+lerp(d,c),y+1],l:[`v${x},${y}`,x,y+lerp(a,d)]};
  const center=(a+b+c+d)/4>T;
  const table={1:[["l","b"]],2:[["b","r"]],3:[["l","r"]],4:[["t","r"]],5:center?[["l","t"],["b","r"]]:[["l","b"],["t","r"]],6:[["t","b"]],7:[["l","t"]],8:[["l","t"]],9:[["t","b"]],10:center?[["t","r"],["l","b"]]:[["l","t"],["b","r"]],11:[["t","r"]],12:[["l","r"]],13:[["b","r"]],14:[["l","b"]]};
  for(const [u,q] of table[idx]) segs.push([P[u],P[q]]);
 }
 const map=new Map();segs.forEach((s,i)=>{for(const e of s){const k=e[0];if(!map.has(k))map.set(k,[]);map.get(k).push(i)}});
 const used=new Uint8Array(segs.length);const loops=[];
 for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const pts=[segs[i][0],segs[i][1]];let cur=segs[i][1][0];
  for(;;){const nx=(map.get(cur)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];const o=s[0][0]===cur?s[1]:s[0];pts.push(o);cur=o[0];}
  loops.push(pts.map(e=>[e[1]+ox,e[2]+oy]));}
 return loops.filter(l=>l.length>8);
}
function dp(pts,eps){if(pts.length<3)return pts;const [a,b]=[pts[0],pts[pts.length-1]];let md=0,mi=0;
 for(let i=1;i<pts.length-1;i++){const d=Math.abs((b[0]-a[0])*(a[1]-pts[i][1])-(a[0]-pts[i][0])*(b[1]-a[1]))/(Math.hypot(b[0]-a[0],b[1]-a[1])||1);if(d>md){md=d;mi=i}}
 if(md>eps){const l=dp(pts.slice(0,mi+1),eps),r=dp(pts.slice(mi),eps);return l.slice(0,-1).concat(r)}return [a,b]}
function closed(l,eps){let fi=0,fd=0;l.forEach((q,i)=>{const d=Math.hypot(q[0]-l[0][0],q[1]-l[0][1]);if(d>fd){fd=d;fi=i}});return dp(l.slice(0,fi+1),eps).slice(0,-1).concat(dp(l.slice(fi),eps).slice(0,-1))}
function toPath(loops){return loops.map(l=>{const s=closed(l,0.45);return "M"+s.map(q=>q[0].toFixed(1)+" "+q[1].toFixed(1)).join("L")+"Z"}).join("")}
const word=trace(grid(0,SPLIT,3)),mark=trace(grid(SPLIT,W-1,40));
let bb=[1e9,1e9,-1e9,-1e9];for(const l of [...word,...mark])for(const [x,y] of l){bb=[Math.min(bb[0],x),Math.min(bb[1],y),Math.max(bb[2],x),Math.max(bb[3],y)]}
let mb=[1e9,1e9,-1e9,-1e9];for(const l of mark)for(const [x,y] of l){mb=[Math.min(mb[0],x),Math.min(mb[1],y),Math.max(mb[2],x),Math.max(mb[3],y)]}
const out={wordColor:stats(0,SPLIT),markColor:stats(SPLIT,W-1),bbox:bb.map(Math.round),markBox:mb.map(Math.round),word:toPath(word),mark:toPath(mark),wordLoops:word.length,markLoops:mark.length};
fs.writeFileSync(OUT,JSON.stringify(out));console.log(JSON.stringify({...out,word:out.word.length,mark:out.mark.length}));
