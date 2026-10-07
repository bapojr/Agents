'use client';
import {useEffect,useRef,useState} from 'react';
import {FigmaAsset} from './figma-assets';
export function ReferencePaywall({reason,onClose}:{reason:'export'|'limit';onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [billing,setBilling]=useState<'Monthly'|'Annual'>('Annual'),[notice,setNotice]=useState(''),[included,setIncluded]=useState(false);
  useEffect(()=>{const dialog=ref.current!,focus=document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();focus?.focus();};},[]);
  return <dialog ref={ref} className="reference-paywall" aria-labelledby="reference-upgrade-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <button className="paywall-close" aria-label="Close upgrade" onClick={onClose}><FigmaAsset name="paywall-imgImg"/></button>
    <h2 id="reference-upgrade-title">{reason==='export'?'Upgrade to export references':'Upgrade for more tabular insights'}</h2>
    <div className="billing-toggle" aria-label="Billing period">{(['Monthly','Annual'] as const).map(b=><button key={b} aria-pressed={billing===b} onClick={()=>setBilling(b)}>{b}</button>)}</div>
    {(['Prime','Pro'] as const).map(plan=><section className={`paywall-plan ${plan.toLowerCase()}`} key={plan}>{plan==='Prime'&&<span className="plan-recommended">Recommended</span>}<h3><FigmaAsset name={plan==='Prime'?'paywall-imgGroup11097':'paywall-imgGroup11098'}/>{plan}</h3><div className="plan-description"><div><strong>{plan==='Prime'?'More research possibilities':'Go further with your research'}</strong><p>Export references and explore more tabular insights.</p></div><span className="plan-price">Pricing unavailable<small>{billing} billing</small></span></div><button onClick={()=>setNotice('Checkout is not connected yet. No payment was taken and your plan has not changed.')}>Get {plan}</button></section>)}
    <p className="paywall-status" role="status">{notice||'Plans and checkout will be available when billing is connected.'}</p>
    <button className="plan-inclusions" aria-expanded={included} onClick={()=>setIncluded(!included)}>See what’s included<FigmaAsset name="paywall-imgPrimary"/></button>
    {included&&<ul className="plan-benefits"><li>Export research references.</li><li>Enhanced tabular data beyond the free reference limit.</li><li>All references remain discoverable on the free plan.</li></ul>}
  </dialog>;
}
