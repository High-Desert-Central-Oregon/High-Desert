// Local-only fixture: real controls/dictionaries, no backend, no submissions.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChoiceCard } from '../../../components/ui/choice-card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ALL_METHODS } from '../../../lib/verification';
import { en } from '../../../lib/i18n/dictionaries/en';
import { es } from '../../../lib/i18n/dictionaries/es';
import '../../../app/globals.css';
import '../../../app/(site)/tokens.css';
import '../../../app/(site)/site-base.css';
import '../../../app/(site)/join/join.css';
import '../../../app/(site)/n/[slug]/pledge.css';
import '../../../components/bug-reports/reporter.css';
function Fixture() {
  const [method, setMethod] = useState('id');
  const [spanish, setSpanish] = useState(false);
  const [dark, setDark] = useState(false);
  const dict = spanish ? es : en;
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  return <>
    <main className="mx-auto max-w-2xl p-6 flex flex-col gap-6" lang={spanish ? 'es' : 'en'}>
      <h1>Color accessibility fixture</h1>
      <Button onClick={() => setSpanish(!spanish)}>English / Español</Button>
      <Button onClick={() => setDark(!dark)}>Website light / dark</Button>
      <fieldset className="flex flex-col gap-3"><legend>{dict.verify.methodLegend}</legend>
        {ALL_METHODS.map(m => <ChoiceCard key={m} id={`method-${m}`} name="method" value={m} checked={method===m} onChange={() => setMethod(m)} required title={dict.verify.methods[m]} description={dict.verify.methodHints[m]} />)}
      </fieldset>
      <label htmlFor="reply">Verification reply</label><textarea id="reply" className="field-control min-h-24 rounded border bg-background p-2" />
      <label htmlFor="name">Shared input</label><Input id="name" placeholder="Name" />
      <label htmlFor="language">Invitation language</label><select id="language" className="field-control min-h-11 border bg-background p-2"><option>English</option><option>Español</option></select>
      <a href="#website" className="flex border-b py-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-ring">Focusable list row</a>
      <Button>Continue</Button>
    </main>
    <section id="website" className="site-root"><div className="join wrap">
      <h2>Website controls</h2><div className="formcard"><div className="fk">Opening in Redmond soon</div><h3>Get on the list.</h3>
        <label htmlFor="email">Email</label><input id="email" type="email" placeholder="you@example.org" />
        <button className="submitb" type="button">Join the list</button>
        <p className="formnote">Our <a href="#website">privacy commitments</a> explain the rest.</p>
      </div><a href="#website" className="btn-rust">Join the beta</a>
      <div className="pledge-input-row"><input aria-label="Pledge email" placeholder="you@example.org" /><button className="pledge-submit">Count me in</button></div>
      <button className="pledge-copy">Copy link</button><button className="pledge-copy" data-copied>Copied</button>
    </div></section>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
