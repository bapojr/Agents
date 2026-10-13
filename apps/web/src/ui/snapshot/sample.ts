/** Explicitly requested design-preview copy. Never enters scholarly data or the AI cache. */
export const SNAPSHOT_PREVIEW_COPY:Record<string,string>={
  objective:'study objective',
  methods:'research methodology',
  population:'population studied',
  'sample-size':'sample sizes',
  outcomes:'study outcome here',
  results:'study results come here',
  limitations:'research study limitation comes here',
  'ai-summary':'a concise ai generated summary of the paper will appear here once you click generate snapshot.',
};
export const SAMPLE_SNAPSHOT={
  topic:'Walking breaks and concentration',
  cells:{
    objective:'To explore whether taking short walking breaks during the working day could improve concentration and reduce perceived mental fatigue among office workers.',
    methods:'In this fictional six-week study, participants were assigned to either take a five-minute walking break every hour or follow their usual work routine. Attention tasks and self-reported fatigue questionnaires were completed at the beginning and end of the study.',
    population:'Adults aged 25–55 working in desk-based roles, with similar working hours and no regular daytime exercise routine.',
    'sample-size':'120 participants, with 60 assigned to each group.',
    outcomes:'Sustained attention, task completion accuracy, perceived mental fatigue and adherence to the scheduled walking breaks.',
    results:'For this sample layout, the walking-break group showed higher attention scores and reported less afternoon fatigue than the comparison group. Task accuracy improved modestly, while the strongest changes were reported by participants who followed the break schedule consistently.',
    limitations:'The fictional study uses a small sample from a single workplace and relies partly on self-reported outcomes. The short follow-up period does not show whether any changes would persist over time.',
    'ai-summary':'This fictional example illustrates how a Study Snapshot could summarise a paper about walking breaks and concentration. The sample describes a six-week comparison of scheduled walking breaks with usual work routines, including attention, accuracy and fatigue outcomes. It also demonstrates how limitations would appear alongside the results. These details are placeholder copy for reviewing the design, not findings from the paper currently open.',
  } as Record<string,string>,
};
