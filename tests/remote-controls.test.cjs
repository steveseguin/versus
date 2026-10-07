const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.env.VERSUS_HTML || path.join(root, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1];
const attr = x => 'data-' + x.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase(); this.attrs = {...attrs}; this.children = []; this.parentNode = null;
    this.style = {setProperty() {}}; this.events = {}; this.value = attrs.value || '';
    this.classList = {
      contains: c => this.className.split(/\s+/).includes(c),
      add: (...cs) => {this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...cs])].join(' ');},
      remove: (...cs) => {this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(' ');},
      toggle: c => {const had = this.classList.contains(c); this.classList[had ? 'remove' : 'add'](c); return !had;},
    };
    this.dataset = new Proxy({}, {get: (_, k) => this.attrs[attr(k)], set: (_, k, v) => (this.attrs[attr(k)] = String(v), true)});
  }
  get id() {return this.attrs.id || '';}
  set id(x) {this.attrs.id = x;}
  get className() {return this.attrs.class || '';}
  set className(x) {this.attrs.class = x;}
  appendChild(c) {if(c.parentNode)c.remove(); this.children.push(c); c.parentNode=this; return c;}
  append(c) {return this.appendChild(c);}
  remove() {if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}
  cloneNode(deep) {const x=new Element(this.tagName,this.attrs);if(deep)this.children.forEach(c=>x.appendChild(c.cloneNode(true)));return x;}
  addEventListener(k,f) {(this.events[k] ||= []).push(f);}
  setAttribute(k,v) {this.attrs[k]=String(v);}
  getAttribute(k) {return this.attrs[k];}
  focus() {}
  getContext() {return {canvas:this,clearRect(){},fillRect(){},getImageData(){return {};},putImageData(){}};}
  matches(s) {
    const attributes = [...s.matchAll(/\[([^\]=]+)(?:=['"]?([^\]'"\s]*)['"]?)?\]/g)];
    if(!attributes.every(([,a,v])=>a in this.attrs && (v===undefined || this.attrs[a]===v)))return false;
    s=s.replace(/\[[^\]]+\]/g,'');
    for(const [,c] of s.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(c))return false;
    const id=s.match(/#([\w-]+)/);if(id && this.id!==id[1])return false;
    const tag=s.match(/^[\w-]+/);if(tag && tag[0].toUpperCase()!==this.tagName)return false;
    return true;
  }
  querySelectorAll(selector) {
    const parts=selector.trim().split(/\s+/);
    const test=(node,i)=>{
      if(i<0)return true;
      if(!node || !node.matches(parts[i]))return false;
      if(i===0)return true;
      if(parts[i-1]==='>')return test(node.parentNode,i-2);
      for(let p=node.parentNode;p && p!==this.parentNode;p=p.parentNode)if(test(p,i-1))return true;
      return false;
    };
    const found=[];const walk=n=>{for(const c of n.children){if(test(c,parts.length-1))found.push(c);walk(c);}};walk(this);return found;
  }
  querySelector(s) {return this.querySelectorAll(s)[0] || null;}
  closest(s) {for(let n=this;n;n=n.parentNode)if(n.matches(s))return n;return null;}
}
// Parse only element structure; no resources load, layout runs, or scripts execute here.
function parseHTML(source) {
  source=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  const doc=new Element('document'),stack=[doc],voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  for(const token of source.match(/<[^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g) || []) {
    const end=token.match(/^<\/([\w-]+)/);
    if(end) {for(let i=stack.length-1;i>0;i--)if(stack[i].tagName.toLowerCase()===end[1].toLowerCase()){stack.length=i;break;}continue;}
    const start=token.match(/^<([\w-]+)/);if(!start)continue;
    const tag=start[1].toLowerCase(),attrs={};
    const body=token.slice(start[0].length).replace(/\/?\s*>$/,'');
    for(const [,key,quoted,doubleQuoted,singleQuoted,bare] of body.matchAll(/([^\s=/>]+)(?:\s*=\s*((?:"([^"]*)")|(?:'([^']*)')|([^\s>]+)))?/g))attrs[key.toLowerCase()]=doubleQuoted ?? singleQuoted ?? bare ?? '';
    const e=new Element(tag,attrs);stack.at(-1).appendChild(e);if(!voidTags.has(tag) && !/\/\s*>$/.test(token))stack.push(e);
  }
  return doc;
}
function fixture() {
  const document=parseHTML(html);
  document.body=document.querySelector('body');document.documentElement=document.querySelector('html');
  document.getElementById=id=>document.querySelector('#'+id);document.createElement=tag=>new Element(tag);
  const messages=[],alerts=[],timers=new Map(); let nextTimer=0,promptValue=null;
  const sandbox={document,console:{log(){},warn(){},error(){}},navigator:{userAgent:'Chrome/130.0.0'},URLSearchParams,URL,Blob,TextEncoder,
    location:{search:'',pathname:'/'},history:{pushState(){}},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    alert:x=>alerts.push(x),prompt:()=>promptValue,setTimeout:(f,ms,...args)=>{timers.set(++nextTimer,{f,ms,args});return nextTimer;},clearTimeout:id=>timers.delete(id),addEventListener(){}};
  sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(script,sandbox,{filename:'index.html:app'});
  sandbox.iframe={contentWindow:{postMessage:m=>messages.push(JSON.parse(JSON.stringify(m)))}};
  sandbox.roomname='test_room';
  const stats=(publisher,viewer='shared_viewer',overrides={})=>{
    sandbox.streamInfo[publisher]={info:{remote:true},label:publisher};
    sandbox.remoteStats({[viewer]:{video_bitrate_kbps:1000,resolution:'1920 x 1080 @ 30',label:'OBS scene',...overrides}},publisher,'stream_'+publisher);
    return document.getElementById('container_'+publisher);
  };
  const detail=(container,viewer='shared_viewer')=>container.querySelector(`[data-action-type="stats-graphs-details-container"][data-uid="${viewer}"]`);
  const click=e=>{assert.ok(e && e.onclick,'handler exists');e.onclick.call(e,{preventDefault(){}});};
  return {document,sandbox,messages,alerts,timers,stats,detail,click,setPrompt:v=>promptValue=v};
}
const hasOpen=(detail,type)=>!detail.querySelector('.'+type+'-dropdown').classList.contains('hidden');

for(const type of ['bitrate','resolution']) {
  test(`${type}: single publisher opens its own dropdown`,()=>{
    const f=fixture(),a=f.detail(f.stats('publisher_A'));f.click(a.querySelector(`[data-${type}]`));assert.equal(hasOpen(a,type),true);
  });
  test(`${type}: different viewers remain isolated`,()=>{
    const f=fixture(),a=f.detail(f.stats('publisher_A','viewer_A'),'viewer_A'),b=f.detail(f.stats('publisher_B','viewer_B'),'viewer_B');
    f.click(b.querySelector(`[data-${type}]`));assert.equal(hasOpen(a,type),false);assert.equal(hasOpen(b,type),true);
  });
  test(`${type}: shared viewer selects the requested publisher`,()=>{
    const f=fixture(),a=f.detail(f.stats('publisher_A')),b=f.detail(f.stats('publisher_B'));
    f.click(b.querySelector(`[data-${type}]`));assert.equal(hasOpen(a,type),false,'other publisher must remain closed');assert.equal(hasOpen(b,type),true,'clicked publisher must open');
  });
  test(`${type}: each publisher's visible menu sends to that publisher`,()=>{
    const f=fixture(),ids=['publisher_C','publisher_A','publisher_B'];
    ids.forEach(id=>f.stats(id));
    for(const id of ids) {
      const d=f.detail(f.document.getElementById('container_'+id));
      f.click(d.querySelector(`[data-${type}]`));
      const open=f.document.querySelectorAll('.'+type+'-dropdown').filter(e=>!e.classList.contains('hidden'));
      assert.equal(open.length,1);const menu=open[0];
      f.click(menu.querySelector(type==='bitrate'?'[data-bitrate-option="5000"]':'[data-res-option="1080"]'));
      assert.deepEqual(f.messages.at(-1),type==='bitrate'?{targetBitrate:5000,requestAs:'shared_viewer',UUID:id}:{targetHeight:1080,requestAs:'shared_viewer',UUID:id});
      f.click(d.querySelector(`[data-${type}]`));assert.equal(hasOpen(d,type),false);
    }
  });
  test(`${type}: later publisher works when first publisher's viewer tab is hidden`,()=>{
    const f=fixture(),a=f.stats('publisher_A');f.stats('publisher_A','other_viewer');const b=f.detail(f.stats('publisher_B'));
    assert.equal(f.detail(a).classList.contains('unselected'),true);
    f.click(b.querySelector(`[data-${type}]`));assert.equal(hasOpen(f.detail(a),type),false);assert.equal(hasOpen(b,type),true);
  });
  test(`${type}: reversed insertion order and numeric viewer remain local`,()=>{
    const f=fixture(),b=f.detail(f.stats('publisher_B','12345'),'12345'),a=f.detail(f.stats('publisher_A','12345'),'12345');
    f.click(a.querySelector(`[data-${type}]`));assert.equal(hasOpen(b,type),false);assert.equal(hasOpen(a,type),true);
  });
  test(`${type}: disabled remote control sends nothing`,()=>{
    const f=fixture(),a=f.detail(f.stats('publisher_A'));f.sandbox.streamInfo.publisher_A.info.remote=false;
    f.click(a.querySelector(`[data-${type}]`));assert.equal(hasOpen(a,type),false);assert.equal(f.alerts.length,1);assert.equal(f.messages.length,0);
  });
  test(`${type}: direct button includes publisher and viewer identity`,()=>{
    const f=fixture(),a=f.detail(f.stats('publisher_A')),b=f.detail(f.stats('publisher_B'));
    const sel=type==='bitrate'?'[data-bitrate-option="2000"]':'[data-res-option="720"]';f.click(b.querySelector(sel));
    assert.deepEqual(f.messages,[type==='bitrate'?{targetBitrate:2000,requestAs:'shared_viewer',UUID:'publisher_B'}:{targetHeight:720,requestAs:'shared_viewer',UUID:'publisher_B'}]);
  });
  test(`${type}: repeated updates do not accumulate option sends`,()=>{
    const f=fixture();for(let i=0;i<4;i++)f.stats('publisher_A');const d=f.detail(f.stats('publisher_A'));
    f.click(d.querySelector(type==='bitrate'?'[data-bitrate-option="1000"]':'[data-res-option="360"]'));assert.equal(f.messages.length,1);
  });
}
test('tabs select one viewer and preserve selection on update',()=>{
  const f=fixture(),c=f.stats('publisher_A','viewer_A');f.stats('publisher_A','viewer_B');
  f.click(c.querySelector('[data-action-type="tab-section"][data-uid="viewer_A"]'));f.stats('publisher_A','viewer_A');
  assert.equal(f.detail(c,'viewer_A').classList.contains('unselected'),false);assert.equal(f.detail(c,'viewer_B').classList.contains('unselected'),true);
});
test('no viewer stats displays the existing empty state',()=>{
  const f=fixture(),c=f.stats('publisher_A');f.sandbox.remoteStats({},'publisher_A','stream_publisher_A');
  assert.ok(c.querySelectorAll('[data-no-scenes]').every(e=>!e.classList.contains('hidden')));
});
test('cancel custom values does not send',()=>{
  const f=fixture(),a=f.detail(f.stats('publisher_A'));f.setPrompt(null);
  f.click(a.querySelector('[data-bitrate-option="custom"]'));f.click(a.querySelector('[data-res-option="custom"]'));assert.equal(f.messages.length,0);
});
test('custom values preserve target identity',()=>{
  const f=fixture(),a=f.detail(f.stats('publisher_A'));f.setPrompt('1234');f.click(a.querySelector('[data-bitrate-option="custom"]'));f.setPrompt('900');f.click(a.querySelector('[data-res-option="custom"]'));
  assert.deepEqual(f.messages,[{targetBitrate:1234,requestAs:'shared_viewer',UUID:'publisher_A'},{targetHeight:900,requestAs:'shared_viewer',UUID:'publisher_A'}]);
});
