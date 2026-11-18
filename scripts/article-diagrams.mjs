// Layouts are deliberately specific to each article. Coordinates share a grid;
// branches, dependencies, and recovery paths are authored individually.
const n = (id, label, column, row, shape = 'process', tone = 'green') => ({ id, label, x: 45 + column * 250, y: 110 + row * 140 - (shape === 'decision' ? 10 : 0), w: 190, h: shape === 'decision' ? 100 : 80, shape, tone });
const e = (from, to, label = '', options = {}) => ({ from, to, label, ...options });
const g = (title, subtitle, nodes, edges) => ({ title, subtitle, width: 780, height: Math.max(...nodes.map(node => node.y + node.h)) + 65, nodes, edges });

export const articleDiagrams = {
  'dotnet-11-upgrade-with-confidence': g('A migration with evidence and an exit', 'Keep the previous artifact available until the new release is proven.', [
    n('inventory', 'Inventory SDK, APIs\nand dependencies', 1, 0, 'document'),
    n('upgrade', 'Select .NET 11\nUpdate compatible packages', 1, 1),
    n('contracts', 'Contracts\npass?', 1, 2, 'decision', 'amber'),
    n('repair', 'Investigate\nFix incompatibility', 0, 2, 'process', 'red'),
    n('canary', 'Deploy a small canary', 1, 3),
    n('health', 'Signals\nhealthy?', 1, 4, 'decision', 'amber'),
    n('rollback', 'Restore the previous\napproved artifact', 2, 4, 'process', 'red'),
    n('promote', 'Expand rollout\nKeep observing', 1, 5, 'terminal')
  ], [e('inventory','upgrade'), e('upgrade','contracts'), e('contracts','repair','Fail'), e('repair','upgrade','Recheck',{fromSide:'top',toSide:'left'}), e('contracts','canary','Pass'), e('canary','health'), e('health','rollback','No'), e('health','promote','Yes')]),

  'csharp-15-modeling-business-outcomes': g('One lookup, explicit outcome types', 'The union is a boundary contract; the default null state is handled separately.', [
    n('lookup','Lookup product ID',1,0,'terminal'),
    n('exists','Product\nexists?',1,1,'decision','amber'),
    n('found','ProductFound\nID + product name',0,2),
    n('missing','ProductMissing\nRequested ID',2,2,'process','blue'),
    n('union','LookupOutcome\nKnown case types',1,3,'document'),
    n('match','Pattern-match\nevery expected case',1,4),
    n('null','Default contents\nare null',2,4,'process','red'),
    n('response','Return an intentional\nclient response',0,5,'terminal'),
    n('reject','Reject uninitialized\noutcome',2,5,'terminal','red')
  ], [e('lookup','exists'), e('exists','found','Yes'), e('exists','missing','No'), e('found','union'), e('missing','union'), e('union','match'), e('null','match','Check',{dashed:true}), e('match','response','Known case'), e('null','reject')]),

  'async-cancellation-deadlines-dotnet': g('One cancellation boundary, many participants', 'Cancellation is a cooperative signal. It cannot undo committed side effects.', [
    n('caller','Caller cancellation',0,0,'terminal'), n('budget','Operation deadline',2,0,'terminal','amber'),
    n('linked','Linked cancellation token',1,1),
    n('a','Read A\nPass the token',0,2), n('b','Read B\nPass the token',1,2), n('c','Read C\nPass the token',2,2),
    n('await','Await the complete group\nObserve all task outcomes',1,3),
    n('result','Return result, cancellation,\nor failure deliberately',1,4,'terminal')
  ], [e('caller','linked'),e('budget','linked'),e('linked','a'),e('linked','b'),e('linked','c'),e('a','await'),e('b','await'),e('c','await'),e('await','result')]),

  'minimal-api-validation-problem-details': g('Reject the request at the right boundary', 'HTTP responses distinguish invalid input, business conflict, and unexpected failure.', [
    n('http','HTTP request with supported\napplication/json content type',1,0,'terminal'), n('binding','JSON binding\nvalid?',1,1,'decision','amber'),
    n('bad','400 Bad Request\nSafe error contract',0,2,'document','red'), n('validation','Validation\npasses?',1,2,'decision','amber'),
    n('handler','Application handler\nAuthorization is separate',1,3), n('conflict','Business conflict\n409 Problem Details',0,4,'document','amber'),
    n('success','Expected result\nSuccess response',1,4,'terminal'), n('error','Unexpected exception\n500 Problem Details',2,4,'document','red')
  ], [e('http','binding'),e('binding','bad','No'),e('binding','validation','Yes'),e('validation','bad','No'),e('validation','handler','Yes'),e('handler','conflict','Conflict'),e('handler','success','Success'),e('handler','error','Exception')]),

  'ef-core-query-performance-concurrency': g('Carry the original version into the write', 'The version the user read must be the version checked by the update.', [
    n('sql','SQL Server\nRow + rowversion',0,0,'store','blue'), n('read','Project a small DTO\nKeyset page of rows',1,0),
    n('edit','Edit values\nKeep original version',1,1),n('update','Conditional UPDATE\nID + original version',1,2),
    n('match','Expected row\nmatched?',1,3,'decision','amber'),n('saved','Persist changes\nNew rowversion',0,4,'store'),
    n('conflict','Concurrency conflict\nDo not silently overwrite',2,4,'process','red'),n('resolve','Fresh read + explicit\nuser or domain decision',2,5,'process','amber')
  ], [e('sql','read'),e('read','edit'),e('edit','update'),e('update','match'),e('match','saved','Yes'),e('match','conflict','No'),e('conflict','resolve'),e('resolve','edit','Reapply',{route:'right',dashed:true})]),

  'resilient-httpclient-retries-timeouts': g('Retries spend one shared budget', 'Illustrative limits: 10-second outer operation, 8-second handler, 2-second attempt.', [
    n('request','Caller token +\n10-second operation limit',1,0,'terminal'),n('attempt','Send an attempt\n2-second attempt limit',1,1),
    n('response','Usable\nresponse?',1,2,'decision','amber'),n('body','Read response body\nDeserialize with outer token',0,3),
    n('retry','Transient + safe?\nBudget left?',2,3,'decision','amber'),n('backoff','Bounded backoff\nAt most two retries',2,4),
    n('done','Return the result',0,4,'terminal'),n('failure','Report failure / timeout\nObserve cancellation',1,5,'terminal','red')
  ], [e('request','attempt'),e('attempt','response'),e('response','body','Yes'),e('body','done','Success'),e('body','failure','Body / parse / cancel',{fromSide:'right',toSide:'left',via:[[260,570],[260,850]],labelAt:[260,785]}),e('response','retry','No'),e('retry','backoff','Yes'),e('backoff','attempt','Retry',{route:'right'}),e('retry','failure','No',{fromSide:'left',toSide:'right'})]),

  'bounded-background-jobs-dotnet-channels': g('Admission control before background work', 'In-memory acceptance is not durable delivery. A process crash can lose queued jobs.', [
    n('post','Submit report job',1,0,'terminal'),n('space','TryWrite\naccepted?',1,1,'decision','amber'),
    n('busy','Reject overload\n503 response',0,2,'terminal','red'),n('queue','Bounded channel\nFixed capacity',1,2,'store'),
    n('accepted','202 Accepted\nJob is in memory',2,2,'document','blue'),n('worker','Hosted worker\nRead one job',1,3),
    n('scope','New dependency scope\nExecute and observe failure',1,4),n('finish','Dispose the scope\nRead the next job',1,5,'terminal')
  ], [e('post','space'),e('space','busy','No'),e('space','queue','Yes'),e('queue','accepted','Acknowledge'),e('queue','worker'),e('worker','scope'),e('scope','finish'),e('finish','worker','Next',{route:'right',dashed:true})]),

  'opentelemetry-useful-dotnet-signals': g('A signal needs a complete export path', 'Trace context connects operations; bounded dimensions keep metrics useful.', [
    n('incoming','One known HTTP request',1,0,'terminal'),n('server','ASP.NET server activity\nTrace context',1,1),
    n('business','Business activity\nCustom ActivitySource',0,2),n('http','Optional outbound HTTP\nPropagated trace context',2,2),
    n('metrics','Metrics + MeterProvider\nSubscribe to the meter',0,3,'document','blue'),n('provider','TracerProvider\nSubscribe to activity sources',2,3),
    n('export','OTLP exporter\nCollector endpoint',1,4),n('backend','Telemetry backend\nQuery the known request',1,5,'store','blue')
  ], [e('incoming','server'),e('server','business'),e('server','http'),e('business','provider','Trace'),e('http','provider','Trace'),e('business','metrics','Measure'),e('metrics','export'),e('provider','export'),e('export','backend')]),

  'native-aot-practical-dotnet-api': g('Publish-time proof before production', 'Managed tests and native executable tests answer different questions.', [
    n('source','Small API + explicit\nJSON source-generation contract',1,0,'document'),n('managed','Run managed tests\nCheck dependencies',1,1),
    n('publish','Publish for target RID\nCompatible native toolchain',1,2),n('warnings','AOT / trimming\nissues?',1,3,'decision','amber'),
    n('repair','Resolve dynamic code\nand unsupported dependencies',0,3,'process','red'),n('native','Run the native executable\nSmoke-test real behavior',1,4),
    n('measure','Measure startup, memory,\nthroughput, deployment size',1,5),n('decision','Choose AOT or managed\nfrom the measured tradeoff',1,6,'terminal')
  ], [e('source','managed'),e('managed','publish'),e('publish','warnings'),e('warnings','repair','Yes'),e('repair','publish','Rebuild',{fromSide:'top',toSide:'left'}),e('warnings','native','No'),e('native','measure'),e('measure','decision')]),

  'integration-testing-aspnet-core-contracts': g('Cross the public HTTP boundary', 'Keep provider semantics and deployed-artifact behavior in their own test layers.', [
    n('tests','xUnit contract cases\nValid + invalid quantities',1,0,'document'),n('factory','WebApplicationFactory\nReal application host',1,1),
    n('request','HTTP client\nPOST /quotes',1,2),n('pipeline','Routing, JSON binding,\nvalidation, handler',1,3),
    n('valid','Valid quantity\n200 + quote JSON',0,4,'document'),n('invalid','Invalid quantity\n400 + validation problem',2,4,'document','amber'),
    n('assert','Assert status, media type,\nand meaningful fields',1,5),n('layers','Separate provider tests\nand artifact smoke tests',1,6,'document','blue')
  ], [e('tests','factory'),e('factory','request'),e('request','pipeline'),e('pipeline','valid','Accepted'),e('pipeline','invalid','Rejected'),e('valid','assert'),e('invalid','assert'),e('assert','layers','Complement',{dashed:true})]),

  'dotnet-circleci-build-test': g('One pipeline, explicit failure boundaries', 'Build once in Release; test that build and preserve the evidence.', [
    n('commit','Commit + dependency lockfiles',1,0,'document'),n('restore','Checkout + pinned SDK\nLocked restore',1,1),
    n('build','Release build\nNo second restore',1,2),n('test','VSTest execution\nNo second build',1,3),
    n('pass','Required tests\npass?',1,4,'decision','amber'),n('failed','Fail the job\nInspect TRX + logs',0,5,'terminal','red'),
    n('ready','Verified build evidence\nReady for packaging',2,5,'document')
  ], [e('commit','restore'),e('restore','build'),e('build','test'),e('test','pass'),e('pass','failed','No'),e('pass','ready','Yes')]),

  'build-once-promote-docker-digest': g('Promote identity, not another build', 'Staging and production consume exactly the same immutable registry digest.', [
    n('source','Reviewed source commit',1,0,'document'),n('build','Build + test image once\nPush to registry',1,1),
    n('digest','Image digest + release record\nCommit, CI run, evidence',1,2,'document','blue'),n('staging','Deploy digest to staging\nRun acceptance checks',1,3),
    n('gate','Evidence\napproved?',1,4,'decision','amber'),n('halt','Stop promotion\nInvestigate failed evidence',0,5,'terminal','red'),
    n('prod','Deploy the same digest\nto production',2,5),n('previous','Earlier approved digest\nAvailable for rollback',0,6,'store','blue')
  ], [e('source','build'),e('build','digest'),e('digest','staging'),e('staging','gate'),e('gate','halt','No'),e('gate','prod','Yes'),e('previous','prod','Rollback selection',{dashed:true,fromSide:'right',toSide:'bottom'})]),

  'circleci-aws-oidc-short-lived-credentials': g('Exchange identity only after trust matches', 'A valid session remains constrained by the AWS role permission policy.', [
    n('job','CircleCI Cloud job\nSigned OIDC V3 token',1,0,'document'),n('claims','AWS trust policy\nIssuer + audience + claims',1,1),
    n('match','Claims match?\nSource allowed?',1,2,'decision','amber'),n('deny','Deny token exchange\nNo AWS session issued',0,3,'terminal','red'),
    n('sts','AWS STS\nShort-lived session',2,3),n('policy','Role permissions\nOnly required resources',2,4),
    n('deploy','Authorized deploy action\nSession expires',2,5,'terminal')
  ], [e('job','claims'),e('claims','match'),e('match','deny','No'),e('match','sts','Yes'),e('sts','policy'),e('policy','deploy')]),

  'blue-green-deployment-rollback': g('Switch traffic only after readiness is proven', 'Keep the release lock through staging deployment, checks, swap, and observation.', [
    n('live','Production slot\nCurrent release',0,0,'store','blue'),n('lock','Acquire serialized\nchange window',2,0),n('candidate','Deploy candidate\nto staging slot',2,1,'store'),
    n('preflight','Preflight + readiness checks\nCompatible data and settings',2,2),n('ready','Candidate\nready?',2,3,'decision','amber'),
    n('keep','Leave traffic on\ncurrent production',0,3,'terminal','blue'),n('swap','Swap slots\nVerify live release identity',2,4),
    n('observe','Observe user-facing signals',2,5),n('stable','Signals\nhealthy?',1,6,'decision','amber'),
    n('rollback','Verify data + identities\nSwap back safely',0,7,'process','red'),n('accept','Accept the new release\nKeep normal monitoring',2,7,'terminal')
  ], [e('lock','candidate'),e('candidate','preflight'),e('preflight','ready'),e('ready','keep','No'),e('live','keep','Still serving',{dashed:true}),e('ready','swap','Yes'),e('swap','observe'),e('observe','stable'),e('stable','rollback','No'),e('stable','accept','Yes')]),

  'faster-circleci-without-skipping-tests': g('Parallel execution, one test inventory', 'Cache downloads, transfer workflow outputs in workspaces, retain reports as artifacts.', [
    n('inventory','Full test inventory\nMeasured baseline',1,0,'document'),n('cache','Dependency download cache\nA miss remains correct',0,1,'store','blue'),
    n('split','Timing-informed partition\nSame suite contract',1,1),n('s1','Shard 1\nIsolated execution',0,2),n('s2','Shard 2\nIsolated execution',1,2),n('s3','Shard 3\nIsolated execution',2,2),
    n('reports','Collect all JUnit reports\nUnique report identities',1,3,'document'),n('compare','Union matches\nfull inventory?',1,4,'decision','amber'),
    n('repair','Fail the required workflow\nFix coverage or failures',0,5,'terminal','red'),n('shards','All required\nshards pass?',2,5,'decision','amber'),n('accept','Compare duration + cost\nAccept measured improvement',2,6,'terminal')
  ], [e('inventory','split'),e('cache','split','Reuse',{dashed:true}),e('split','s1'),e('split','s2'),e('split','s3'),e('s1','reports'),e('s2','reports'),e('s3','reports'),e('reports','compare'),e('compare','repair','No'),e('compare','shards','Yes'),e('shards','repair','No'),e('shards','accept','Yes')]),

  'jira-cloud-setup-for-a-real-team': g('Configure the process, then test real access', 'Choose a small workflow and verify it as an ordinary member before scaling.', [
    n('scope','Team purpose + ownership\nChoose Scrum or Kanban',1,0,'document'),n('boundary','Configuration\nshared?',1,1,'decision','amber'),
    n('team','Team-managed space\nLocal configuration',0,2),n('company','Company-managed space\nShared governance',2,2,'process','blue'),
    n('access','Roles + permissions\nVerify visibility',1,3),n('types','Work types + fields\nSmall meaningful workflow',1,4),
    n('board','Map statuses to columns\nCreate a usable backlog',1,5),n('test','Test one automation\nas an ordinary member',1,6,'terminal')
  ], [e('scope','boundary'),e('boundary','team','No'),e('boundary','company','Yes'),e('team','access'),e('company','access'),e('access','types'),e('types','board'),e('board','test')]),

  'jira-delivery-from-backlog-to-release': g('An outcome moves through evidence gates', 'A board status is a signal; release readiness remains an explicit decision.', [
    n('outcome','Define outcome\nAcceptance criteria',1,0,'document'),n('backlog','Refine backlog\nDependencies + small slices',1,1),
    n('ready','Ready to\nstart?',1,2,'decision','amber'),n('clarify','Clarify scope / blockers\nAvoid starting uncertain work',0,2,'process','amber'),
    n('doing','Pull work within capacity\nTrack PR and CI evidence',1,3),n('review','Review + verify\nMeet definition of done',1,4),
    n('release','Release readiness\nDecision + rollback plan',1,5),n('learn','Observe user outcome\nChoose one improvement',1,6,'terminal')
  ], [e('outcome','backlog'),e('backlog','ready'),e('ready','clarify','No'),e('clarify','backlog','Refine',{fromSide:'top',toSide:'left'}),e('ready','doing','Yes'),e('doing','review'),e('review','release'),e('release','learn'),e('learn','backlog','Feedback',{route:'right',dashed:true})]),

  'production-operations-that-close-the-loop': g('Reliability is an operating loop', 'Alerts must connect user impact to an owner, an action, and verification.', [
    n('slo','Define user journey\nSLI + SLO + error budget',1,0,'document'),n('observe','Observe service + dependencies\nUseful telemetry',1,1),
    n('impact','Incident-level\ncoordination?',1,2,'decision','amber'),n('monitor','Continue observing\nAvoid unactionable paging',0,2,'process','blue'),
    n('respond','Declare incident\nAssign response roles',1,3),n('mitigate','Follow runbook decisions\nMitigate current impact',1,4),
    n('verify','Verify end-to-end recovery\nCommunicate status',1,5),n('improve','Review without blame\nImplement owned follow-ups',1,6,'document')
  ], [e('slo','observe'),e('observe','impact'),e('impact','monitor','No'),e('monitor','observe','Watch',{fromSide:'top',toSide:'left'}),e('impact','respond','Yes'),e('respond','mitigate'),e('mitigate','verify'),e('verify','improve'),e('improve','observe','Verify improvements',{route:'right',dashed:true})]),

  'git-worktrees-bisect-reflog': g('Three tools for three kinds of disruption', 'Separate a context switch, a regression search, and local recovery.', [
    n('need','Which kind of\ninterruption?',1,0,'decision','amber'),n('switch','Need a separate checkout',0,1,'document'),n('bug','Need the first bad commit',1,1,'document'),n('lost','Need a lost local pointer',2,1,'document'),
    n('worktree','git worktree\nIndependent working directory',0,2),n('bisect','git bisect\nKnown good + known bad',1,2),n('reflog','git reflog\nInspect local reference history',2,2),
    n('separate','Finish urgent work\nKeep original checkout intact',0,3,'terminal'),n('repro','Run a repeatable check\nClassify each midpoint',1,3),n('rescue','Inspect candidate commit\nCreate a rescue branch',2,3,'terminal'),
    n('culprit','Inspect boundary / candidates\nSkipped commits may limit proof',1,4,'terminal')
  ], [e('need','switch'),e('need','bug'),e('need','lost'),e('switch','worktree'),e('bug','bisect'),e('lost','reflog'),e('worktree','separate'),e('bisect','repro'),e('repro','culprit','Boundary found'),e('reflog','rescue')]),

  'git-commits-built-for-review': g('Shape a reviewable series before sharing it', 'Rewrite only history you own; coordinate any rewrite of already shared work.', [
    n('changes','Working-tree changes',1,0,'document'),n('stage','git add -p\nSelect one coherent intent',1,1),n('inspect','Inspect staged diff\nRun relevant checks',1,2),
    n('commit','Small explanatory commit\nFollow-up fixup commits',1,3,'document'),n('owned','History safe\nto rewrite?',1,4,'decision','amber'),
    n('coordinate','Coordinate with teammates\nKeep shared history safe',0,5,'process','red'),n('checkpoint','Clean working tree\nPreserve old tip and base',2,5),n('rebase','Interactive autosquash\nReview any reused resolution',2,6),
    n('range','Compare with range-diff\nRerun tests after rewriting',2,7),n('review','Share a clear commit series\nEvidence + review context',1,8,'terminal')
  ], [e('changes','stage'),e('stage','inspect'),e('inspect','commit'),e('commit','owned'),e('owned','coordinate','No'),e('owned','checkpoint','Yes'),e('checkpoint','rebase'),e('rebase','range'),e('range','review'),e('coordinate','review','Preserve history')])
};
