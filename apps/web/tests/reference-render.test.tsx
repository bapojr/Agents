import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {TableReferences,StandardReference,REFERENCE_COLUMNS,DEFAULT_COLUMN_IDS} from '../src/ui/reference-components';
import {normalizeCrossref} from '../src/ui/paper-data';
const actions={saved:[],onSave:()=>{},onOpen:()=>{},onCopy:()=>{},onNotice:()=>{}};
const items=(n:number)=>Array.from({length:n},(_,i)=>normalizeCrossref({DOI:`10.1234/render.${i}`,title:[`Dynamic paper ${i}`]})!);
describe('reference presentation',()=>{
 it.each([0,1,19,20,21,51])('renders %i records with the boundary outside the table',n=>{
  const papers=items(n),html=renderToStaticMarkup(createElement(TableReferences,{items:papers,allItems:papers,selected:[],onSelect:()=>{},actions,columns:REFERENCE_COLUMNS,visible:DEFAULT_COLUMN_IDS,onUpgrade:()=>{}}));
  expect((html.match(/<tr data-paper-id=/g)||[]).length).toBe(Math.min(n,20));
  expect((html.match(/class="standard-reference"/g)||[]).length).toBe(Math.max(n-20,0));
  expect(html.includes('Tabular reference limit')).toBe(n>20);
  if(n>20){expect(html.indexOf('</table>')).toBeLessThan(html.indexOf('Tabular reference limit'));expect(html.indexOf('Tabular reference limit')).toBeLessThan(html.indexOf('class="standard-reference"'));}
 });
 it('does not show fabricated metadata in standard cards',()=>{
  const html=renderToStaticMarkup(createElement(StandardReference,{paper:items(1)[0],number:1,selected:false,onSelect:()=>{},actions}));
  expect(html).not.toMatch(/Open access|Verified|Q1|undefined|NaN|0 citations/);
  expect(html).toContain('Dynamic paper 0');
 });
});

import {SearchAnswer} from '../src/ui/search-answer';
import {defaultPreferences} from '../src/ui/thread-state';
describe('search response states',()=>{
 const props={query:'Research query',papers:[],loading:false,error:'',retry:()=>{},preferences:defaultPreferences,actions,onReferences:()=>{},onFilter:()=>{},onFollowup:()=>{},showFollowups:false,onDismiss:()=>{}};
 it('renders loading before an empty state',()=>{const html=renderToStaticMarkup(createElement(SearchAnswer,{...props,loading:true}));expect(html).toContain('Searching papers');expect(html).not.toContain('No papers found');});
 it('renders the API error with a retry action',()=>{const html=renderToStaticMarkup(createElement(SearchAnswer,{...props,error:'The provider is busy'}));expect(html).toContain('role="alert"');expect(html).toContain('Retry search');expect(html).not.toContain('Alzheimer');});
 it('handles a genuine zero-result search',()=>{const html=renderToStaticMarkup(createElement(SearchAnswer,props));expect(html).toContain('No papers found');expect(html).not.toContain('citation-chip');});
});
