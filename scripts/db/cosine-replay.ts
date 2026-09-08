// Benchmark oracle only; this never participates in retrieval or governance.
// The hosted build matches a fixed four-lane, adjacent-tree float32 reduction.
// Chosen once from the retained Q01 diagnosis; never selected per result.
export function cosineReplay(q: readonly number[], d: readonly number[], lanes: 1 | 4) {
  if (!q.length || q.length !== d.length || q.length % lanes !== 0) throw new Error('UNSUPPORTED_COSINE_REPLAY_SHAPE');
  let sums = Array.from({length:lanes},()=>[0,0,0]);
  for(let j=0;j<q.length;j++) {
    const x=Math.fround(q[j]!),y=Math.fround(d[j]!),s=sums[j%lanes]!;
    s[0]=Math.fround(s[0]!+Math.fround(x*y));
    s[1]=Math.fround(s[1]!+Math.fround(x*x));
    s[2]=Math.fround(s[2]!+Math.fround(y*y));
  }
  while(sums.length>1) {
    const next:number[][]=[];
    for(let j=0;j<sums.length;j+=2) next.push(sums[j]!.map((v,k)=>Math.fround(v+sums[j+1]![k]!)));
    sums=next;
  }
  const [dot,nq,nd]=sums[0]!;
  if(!nq || !nd) throw new Error('ZERO_NORM_COSINE_REPLAY');
  return Math.max(-1,Math.min(1,dot!/Math.sqrt(nq*nd)));
}
