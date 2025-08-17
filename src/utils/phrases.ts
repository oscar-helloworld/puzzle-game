let cache:string[]|null=null; let recent:string[]=[];
export async function getRandomPhrase(){ if(!cache){ const res=await fetch("/content/phrases.txt"); const txt=await res.text();
  cache=txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
  if(!cache.length) return null as any;
  const choices=cache.filter(s=>!recent.includes(s)); const pool=choices.length?choices:cache;
  const chosen=pool[Math.floor(Math.random()*pool.length)]; recent.push(chosen); if(recent.length>3) recent.shift(); return chosen;
}
