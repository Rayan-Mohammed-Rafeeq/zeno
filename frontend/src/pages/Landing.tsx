import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, ChevronDown, Menu, X, ShieldCheck,
  TrendingUp, Clock, Star, Check,
  AlertTriangle, Zap, Users, BarChart3, Lock,
  Smile, ThumbsUp, ArrowUpRight,
} from 'lucide-react';
import { NiroLogo } from '@/components/brand/Logo';
import { useTheme } from '@/contexts/ThemeContext';

const LANDING_STYLES = `
  .landing { min-height: 100vh; overflow: hidden; background: var(--bg); color: var(--fg); }
  .landing *, .landing *::before, .landing *::after { box-sizing: border-box; }
  .landing a { color: inherit; text-decoration: none; }
  .landing-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
  .landing-nav { height: 76px; display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 10; }
  .landing-brand { display:flex; align-items:center; gap:10px; font-size:17px; font-weight:800; letter-spacing:.18em; }
  .landing-brand img { width:auto; height:34px; }
  .landing-nav-links { display:flex; align-items:center; gap:30px; color:var(--fg-muted); font-size:14px; font-weight:600; }
  .landing-nav-links a:hover { color:var(--fg); }
  .landing-nav-actions { display:flex; align-items:center; gap:12px; font-size:14px; font-weight:700; }
  .landing-login { color:var(--fg-muted); padding:10px; }
  .landing-login:hover { color:var(--fg); }
  .landing-button { display:inline-flex; min-height:44px; align-items:center; justify-content:center; gap:8px; border-radius:8px; padding:0 17px; font-size:14px; font-weight:750; border:1px solid transparent; transition:transform .2s ease, background .2s ease, border-color .2s ease; }
  .landing-button:hover { transform:translateY(-2px); }
  .landing-button--primary { color:var(--accent-fg); background:var(--accent); box-shadow:0 10px 20px color-mix(in srgb, var(--accent) 22%, transparent); }
  .landing-button--primary:hover { background:var(--accent-hover); }
  .landing-button--secondary { border-color:var(--border-strong); color:var(--fg); background:color-mix(in srgb, var(--surface) 82%, transparent); }
  .landing-button--secondary:hover { background:var(--surface); }
  .landing-menu { display:none; border:0; background:transparent; color:var(--fg); padding:8px; }
  .landing-mobile-panel { display:none; }
  .landing-hero { padding:72px 0 92px; position:relative; }
  .landing-hero::before { content:''; position:absolute; z-index:0; width:720px; height:520px; top:-210px; right:-180px; border-radius:50%; background:radial-gradient(ellipse, color-mix(in srgb, var(--accent) 16%, transparent), transparent 68%); filter:blur(12px); pointer-events:none; }
  .landing-hero-grid { display:grid; grid-template-columns:minmax(0, .88fr) minmax(500px, 1.12fr); align-items:center; gap:56px; position:relative; z-index:1; }
  .landing-eyebrow { display:inline-flex; align-items:center; gap:8px; color:var(--accent); font-size:11px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
  .landing-eyebrow span { width:7px; height:7px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 5px var(--accent-muted); }
  .landing-title { max-width:640px; font-size:clamp(43px, 5.1vw, 72px); letter-spacing:-.065em; line-height:.98; margin:18px 0 22px; font-weight:780; }
  .landing-title em { font-style:normal; color:var(--accent); }
  .landing-copy { max-width:520px; font-size:17px; line-height:1.65; color:var(--fg-muted); margin:0; }
  .landing-hero-actions { display:flex; flex-wrap:wrap; gap:12px; margin:31px 0 27px; }
  .landing-hero-note { display:flex; align-items:center; gap:9px; font-size:13px; color:var(--fg-muted); }
  .landing-hero-note svg { color:var(--success); }
  .landing-console { position:relative; border:1px solid var(--border-strong); border-radius:16px; padding:12px; background:color-mix(in srgb, var(--surface) 91%, var(--accent-muted)); box-shadow:0 28px 65px color-mix(in srgb, var(--fg) 14%, transparent), 0 3px 10px color-mix(in srgb, var(--fg) 6%, transparent); }
  .landing-console::before { content:''; position:absolute; inset:-1px; border-radius:16px; padding:1px; background:linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, transparent), transparent 32%, color-mix(in srgb, var(--accent) 28%, transparent)); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
  .landing-console-bar { height:38px; display:flex; align-items:center; justify-content:space-between; padding:0 7px 8px 10px; border-bottom:1px solid var(--border); color:var(--fg-muted); font-size:12px; font-weight:700; }
  .landing-live { display:flex; align-items:center; gap:7px; color:var(--success); font-size:10px; text-transform:uppercase; letter-spacing:.09em; }
  .landing-live i { width:6px; height:6px; border-radius:50%; background:var(--success); animation:landing-pulse 2.4s ease infinite; }
  .landing-console-main { display:grid; grid-template-columns:1.1fr .9fr; gap:10px; padding-top:10px; }
  .landing-panel { border:1px solid var(--border); background:color-mix(in srgb, var(--surface) 88%, transparent); border-radius:10px; padding:16px; }
  .landing-transaction-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .landing-panel-kicker { text-transform:uppercase; letter-spacing:.12em; color:var(--fg-subtle); font-size:9px; font-weight:800; }
  .landing-transaction-id { margin-top:7px; font-size:13px; font-weight:800; }
  .landing-score { width:50px; height:50px; border:5px solid var(--risk-high-bg); border-top-color:var(--risk-high); border-right-color:var(--risk-high); border-radius:50%; display:grid; place-items:center; color:var(--risk-high); font-size:12px; font-weight:800; }
  .landing-transaction-details { display:grid; grid-template-columns:repeat(2,1fr); gap:11px; padding:15px 0; border-bottom:1px solid var(--border); }
  .landing-detail label { display:block; color:var(--fg-subtle); text-transform:uppercase; font-size:9px; letter-spacing:.08em; font-weight:800; margin-bottom:3px; }
  .landing-detail b { font-size:12px; color:var(--fg); }
  .landing-decision { display:flex; gap:9px; align-items:center; padding-top:14px; color:var(--fg-muted); font-size:12px; }
  .landing-decision svg { color:var(--risk-high); flex:none; }
  .landing-decision strong { color:var(--fg); display:block; font-size:12px; }
  .landing-signals { display:flex; flex-direction:column; gap:10px; }
  .landing-signals h3 { margin:1px 0 3px; font-size:12px; }
  .landing-signal { display:flex; gap:9px; align-items:center; border:1px solid var(--border); border-radius:8px; padding:9px; font-size:11px; color:var(--fg-muted); }
  .landing-signal > span { width:25px; height:25px; display:grid; place-items:center; border-radius:7px; background:var(--accent-muted); color:var(--accent); flex:none; }
  .landing-signal b { display:block; color:var(--fg); font-size:11px; }
  .landing-signal small { color:var(--risk-high); font-size:10px; font-weight:700; }
  .landing-signal-chart { height:71px; display:flex; align-items:end; gap:5px; padding:10px 3px 0; border-top:1px solid var(--border); }
  .landing-signal-chart span { width:100%; border-radius:3px 3px 1px 1px; background:var(--accent-muted); }
  .landing-signal-chart span:nth-child(5), .landing-signal-chart span:nth-child(6) { background:var(--risk-high); }
  .landing-proof { border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:21px 0; }
  .landing-proof-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; }
  .landing-proof-item { display:flex; align-items:center; justify-content:center; gap:9px; color:var(--fg-muted); font-size:13px; font-weight:700; }
  .landing-proof-item svg { color:var(--accent); width:18px; height:18px; }
  .landing-section { padding:118px 0; }
  .landing-section--soft { background:color-mix(in srgb, var(--surface-2) 54%, transparent); border-block:1px solid var(--border); }
  .landing-section-heading { max-width:660px; }
  .landing-section-heading h2 { margin:12px 0 14px; font-size:clamp(32px, 3.7vw, 50px); line-height:1.06; letter-spacing:-.045em; }
  .landing-section-heading p { margin:0; max-width:600px; color:var(--fg-muted); line-height:1.65; font-size:16px; }
  .landing-problem-grid { display:grid; grid-template-columns:.85fr 1.15fr; gap:100px; align-items:center; }
  .landing-problem-list { display:grid; gap:2px; }
  .landing-problem { display:grid; grid-template-columns:40px 1fr; gap:14px; padding:18px 0; border-bottom:1px solid var(--border); }
  .landing-problem-number { color:var(--accent); font-size:12px; padding-top:3px; font-weight:800; letter-spacing:.05em; }
  .landing-problem h3 { margin:0 0 6px; font-size:16px; }
  .landing-problem p { color:var(--fg-muted); font-size:14px; line-height:1.55; margin:0; }
  .landing-flow { position:relative; display:grid; grid-template-columns:repeat(4, 1fr); margin-top:54px; border-top:1px solid var(--border-strong); }
  .landing-flow-step { padding:24px 24px 0 0; position:relative; }
  .landing-flow-step:not(:last-child)::after { content:'→'; position:absolute; top:-13px; right:8px; color:var(--accent); background:var(--bg); padding:0 8px; font-size:19px; }
  .landing-flow-dot { width:12px; height:12px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 6px var(--accent-muted); margin-bottom:24px; }
  .landing-flow-step svg { color:var(--accent); margin-bottom:14px; }
  .landing-flow-step h3 { font-size:16px; margin:0 0 7px; }
  .landing-flow-step p { font-size:13px; color:var(--fg-muted); line-height:1.55; margin:0; max-width:210px; }
  .landing-capabilities { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-top:50px; }
  .landing-capability { border-top:2px solid var(--border-strong); padding:24px 2px; transition:border-color .2s ease, transform .2s ease; }
  .landing-capability:hover { border-color:var(--accent); transform:translateY(-4px); }
  .landing-capability-icon { width:39px; height:39px; display:grid; place-items:center; border-radius:9px; background:var(--accent-muted); color:var(--accent); margin-bottom:18px; }
  .landing-capability h3 { font-size:16px; margin:0 0 9px; }
  .landing-capability p { margin:0; color:var(--fg-muted); line-height:1.6; font-size:13px; }
  .landing-showcase { display:grid; grid-template-columns:1fr 1fr; gap:70px; align-items:center; }
  .landing-showcase-window { border:1px solid var(--border-strong); border-radius:14px; overflow:hidden; background:var(--surface); box-shadow:var(--shadow-lg); }
  .landing-showcase-top { padding:13px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--fg-muted); }
  .landing-showcase-top b { color:var(--fg); font-size:12px; }
  .landing-showcase-body { padding:20px; display:grid; gap:14px; }
  .landing-showcase-row { display:grid; grid-template-columns:42px 1fr auto; gap:12px; align-items:center; padding:12px; background:var(--surface-2); border-radius:9px; }
  .landing-showcase-row > span { width:34px; height:34px; display:grid; place-items:center; border-radius:8px; background:var(--accent-muted); color:var(--accent); }
  .landing-showcase-row b { font-size:12px; display:block; }
  .landing-showcase-row small { font-size:11px; color:var(--fg-muted); }
  .landing-risk-chip { color:var(--risk-high); background:var(--risk-high-bg); padding:5px 7px; border-radius:5px; text-transform:uppercase; font-size:9px; font-weight:800; }
  .landing-callout { padding:18px; border-left:2px solid var(--accent); background:var(--accent-muted); border-radius:0 9px 9px 0; }
  .landing-callout h3 { margin:0 0 8px; font-size:15px; }
  .landing-callout p { color:var(--fg-muted); margin:0; font-size:13px; line-height:1.6; }
  .landing-security { display:grid; grid-template-columns:.8fr 1.2fr; gap:100px; align-items:center; }
  .landing-security-lines { display:grid; gap:0; border-top:1px solid var(--border); }
  .landing-security-line { display:flex; gap:15px; padding:18px 0; border-bottom:1px solid var(--border); }
  .landing-security-line svg { color:var(--accent); flex:none; margin-top:2px; }
  .landing-security-line b { display:block; margin-bottom:4px; font-size:14px; }
  .landing-security-line p { margin:0; font-size:13px; line-height:1.5; color:var(--fg-muted); }
  .landing-cta { margin:0 0 84px; padding:75px clamp(24px, 8vw, 96px); border:1px solid var(--border-strong); border-radius:18px; position:relative; overflow:hidden; background:var(--surface); }
  .landing-cta::after { content:''; width:480px; height:480px; position:absolute; right:-190px; top:-250px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb,var(--accent) 20%, transparent), transparent 68%); pointer-events:none; }
  .landing-cta > * { position:relative; z-index:1; }
  .landing-cta h2 { max-width:680px; margin:14px 0 17px; letter-spacing:-.05em; line-height:1.02; font-size:clamp(34px, 4vw, 54px); }
  .landing-cta p { max-width:560px; color:var(--fg-muted); margin:0 0 27px; line-height:1.6; }
  .landing-footer { border-top:1px solid var(--border); padding:38px 0; }
  .landing-footer-inner { display:flex; align-items:center; justify-content:space-between; gap:30px; }
  .landing-footer-copy { color:var(--fg-subtle); font-size:12px; }
  .landing-footer-links { display:flex; flex-wrap:wrap; gap:20px; color:var(--fg-muted); font-size:12px; }
  @keyframes landing-pulse { 50% { opacity:.35; transform:scale(.75); } }
  @media (prefers-reduced-motion: reduce) { .landing *, .landing *::before, .landing *::after { animation:none!important; transition:none!important; } }
  @media (max-width: 950px) { .landing-hero { padding-top:50px; } .landing-hero-grid, .landing-problem-grid, .landing-showcase, .landing-security { grid-template-columns:1fr; gap:48px; } .landing-hero-copy { max-width:700px; } .landing-console { max-width:680px; width:100%; } .landing-capabilities { grid-template-columns:repeat(2,1fr); } .landing-proof-grid { grid-template-columns:repeat(2,1fr); row-gap:22px; } }
  @media (max-width: 720px) { .landing-shell { width:min(100% - 32px, 1180px); } .landing-nav { height:68px; } .landing-nav-links, .landing-nav-actions { display:none; } .landing-menu { display:block; } .landing-mobile-panel { position:absolute; display:grid; gap:8px; top:64px; left:16px; right:16px; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--surface); box-shadow:var(--shadow-lg); } .landing-mobile-panel a { padding:9px; color:var(--fg-muted); font-size:14px; font-weight:650; } .landing-mobile-panel .landing-button { margin-top:4px; } .landing-hero { padding:50px 0 62px; } .landing-title { font-size:46px; } .landing-copy { font-size:16px; } .landing-console-main { grid-template-columns:1fr; } .landing-proof-item { justify-content:flex-start; } .landing-section { padding:76px 0; } .landing-flow { grid-template-columns:1fr 1fr; gap:20px 0; } .landing-flow-step:nth-child(2)::after { display:none; } .landing-flow-step { padding-right:16px; } .landing-capabilities { grid-template-columns:1fr; margin-top:35px; } .landing-showcase { gap:38px; } .landing-footer-inner { align-items:flex-start; flex-direction:column; } }
  @media (max-width: 430px) { .landing-title { font-size:39px; } .landing-hero-actions { flex-direction:column; align-items:stretch; } .landing-button { width:100%; } .landing-proof-grid { grid-template-columns:1fr; } .landing-flow { grid-template-columns:1fr; } .landing-flow-step:not(:last-child)::after { display:none; } .landing-flow-dot { margin-bottom:14px; } }
`;

const capabilities = [
  { icon: Activity, title: 'Transaction risk scoring', copy: 'Prioritize review using risk assessments attached to every transaction.' },
  { icon: Fingerprint, title: 'Behavioral analysis', copy: 'Surface device, IP, velocity, and amount-similarity signals that merit attention.' },
  { icon: Network, title: 'Pattern detection', copy: 'Connect suspicious activity into clusters that are difficult to spot one transaction at a time.' },
  { icon: Eye, title: 'Explainable signals', copy: 'Give analysts a clear trail of the indicators behind a risk outcome.' },
  { icon: FileSearch, title: 'Investigation workflow', copy: 'Move from detection to a structured queue for human review and resolution.' },
  { icon: TrendingUp, title: 'Evaluation visibility', copy: 'Measure signal performance to continuously improve operational decision-making.' },
];

export function Landing() {
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = ['Product', 'How it works', 'Risk Intelligence', 'Security'];

  return (
    <>
      <style>{LANDING_STYLES}</style>
      <div className="landing">
        <header className="landing-shell landing-nav">
          <Link to="/" className="landing-brand" aria-label="Niro home"><NiroLogo height={34} forceVariant={resolvedTheme} /><span>NIRO</span></Link>
          <nav className="landing-nav-links" aria-label="Main navigation">
            {navItems.map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</a>)}
          </nav>
          <div className="landing-nav-actions"><Link className="landing-login" to="/login">Log in</Link><Link className="landing-button landing-button--primary" to="/register">Get Started <ArrowRight size={15} /></Link></div>
          <button className="landing-menu" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          {menuOpen && <nav className="landing-mobile-panel" aria-label="Mobile navigation">{navItems.map((item) => <a onClick={() => setMenuOpen(false)} key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</a>)}<Link onClick={() => setMenuOpen(false)} to="/login">Log in</Link><Link className="landing-button landing-button--primary" to="/register">Get Started <ArrowRight size={15} /></Link></nav>}
        </header>

        <main>
          <section className="landing-hero landing-shell" id="product">
            <div className="landing-hero-grid">
              <div className="landing-hero-copy">
                <div className="landing-eyebrow"><span /> Risk intelligence for merchants</div>
                <h1 className="landing-title">Know the risk before it becomes a <em>loss.</em></h1>
                <p className="landing-copy">Niro turns transaction activity into clear, explainable risk intelligence—so your team can spot suspicious patterns, investigate with context, and make confident decisions in real time.</p>
                <div className="landing-hero-actions"><Link className="landing-button landing-button--primary" to="/register">Get Started <ArrowRight size={16} /></Link><a className="landing-button landing-button--secondary" href="#how-it-works">See how it works <ChevronDown size={16} /></a></div>
                <div className="landing-hero-note"><ShieldCheck size={17} /> Built for merchant risk operations—not generic alerts.</div>
              </div>
              <ProductConsole />
            </div>
          </section>

          <section className="landing-proof"><div className="landing-shell landing-proof-grid">
            <Proof icon={Zap} text="Real-time risk analysis" /><Proof icon={Eye} text="Explainable decisions" /><Proof icon={ShieldCheck} text="Secure architecture" /><Proof icon={Network} text="Merchant-focused intelligence" />
          </div></section>

          <section className="landing-section landing-shell" id="risk-intelligence">
            <div className="landing-problem-grid"><div className="landing-section-heading"><div className="landing-eyebrow"><span /> The operational gap</div><h2>More transactions. Less clarity.</h2><p>As payment activity grows, the signals that matter get buried. Static rules cannot keep up with behavior that changes by the minute.</p></div>
            <div className="landing-problem-list">
              <Problem number="01" title="Volume hides the signal" copy="High transaction throughput makes suspicious behavior difficult to isolate." />
              <Problem number="02" title="Rules age quickly" copy="Evolving patterns can move beyond fixed thresholds and one-dimensional checks." />
              <Problem number="03" title="Investigation is expensive" copy="Analysts lose time reconstructing context across customers, payments, devices, and IPs." />
              <Problem number="04" title="Alerts are not answers" copy="Teams need an evidence trail that explains why attention is warranted." />
            </div></div>
          </section>

          <section className="landing-section landing-section--soft" id="how-it-works"><div className="landing-shell">
            <div className="landing-section-heading"><div className="landing-eyebrow"><span /> How Niro works</div><h2>From transaction to informed action.</h2><p>A practical intelligence layer designed around the flow of real merchant risk operations.</p></div>
            <div className="landing-flow">
              <Flow icon={Activity} title="Transaction" copy="Activity enters the risk workflow with its payment and identity context." />
              <Flow icon={Cpu} title="Risk analysis" copy="Signals such as velocity, reuse, and similarity are evaluated." />
              <Flow icon={Network} title="Intelligence" copy="Connected behavior and suspicious clusters are surfaced for review." />
              <Flow icon={Check} title="Decision" copy="Analysts receive a clear recommendation and evidence to act on." />
            </div>
          </div></section>

          <section className="landing-section landing-shell"><div className="landing-section-heading"><div className="landing-eyebrow"><span /> Intelligence, made operational</div><h2>See more than an alert.</h2><p>Niro’s product capabilities map to the work risk teams actually need to do: understand, investigate, and improve.</p></div>
          <div className="landing-capabilities">{capabilities.map(({ icon: Icon, title, copy }) => <article className="landing-capability" key={title}><div className="landing-capability-icon"><Icon size={19} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

          <section className="landing-section landing-section--soft"><div className="landing-shell landing-showcase">
            <div className="landing-showcase-window"><div className="landing-showcase-top"><b>Investigation queue</b><span>Priority view</span></div><div className="landing-showcase-body">
              <ShowcaseRow icon={CircleAlert} name="Payment #TXN-8842" sub="Device reuse · Rapid retries" risk="High risk" />
              <ShowcaseRow icon={Network} name="Cluster CL-184" sub="Connected account activity" risk="Critical" />
              <ShowcaseRow icon={Timer} name="Payment #TXN-8711" sub="Unusual transaction velocity" risk="High risk" />
              <div className="landing-callout"><h3>Evidence, not just escalation.</h3><p>Surface the signals behind a decision before an analyst begins an investigation.</p></div>
            </div></div>
            <div className="landing-section-heading"><div className="landing-eyebrow"><span /> Risk intelligence, not just alerts</div><h2>Give every decision its context.</h2><p>Rather than a disconnected stream of flags, Niro brings together risk signals, relationships, and investigation workflow in one operating view.</p><div className="landing-hero-actions"><Link className="landing-button landing-button--secondary" to="/login">Explore the workspace <ArrowRight size={16} /></Link></div></div>
          </div></section>

          <section className="landing-section landing-shell" id="security"><div className="landing-security"><div className="landing-section-heading"><div className="landing-eyebrow"><span /> Built with restraint</div><h2>Trust starts with visibility.</h2><p>Niro is designed to support controlled risk operations with a focused application surface and auditable activity.</p></div><div className="landing-security-lines">
            <Security icon={ShieldCheck} title="Authenticated workspace access" text="Protected application routes keep operational views within the authenticated product experience." />
            <Security icon={FileSearch} title="Audit trail" text="The product includes an audit view to support visibility into operational activity." />
            <Security icon={Eye} title="Explainable intelligence" text="Risk signals are made available as context for analysts—not hidden behind a black-box outcome." />
          </div></div></section>

          <section className="landing-shell landing-cta"><div className="landing-eyebrow"><span /> Make risk actionable</div><h2>Turn transaction data into confident decisions.</h2><p>Bring clarity to the signals your team already sees—and turn them into a smarter risk operation.</p><Link className="landing-button landing-button--primary" to="/register">Get Started <ArrowRight size={16} /></Link></section>
        </main>
        <footer className="landing-footer"><div className="landing-shell landing-footer-inner"><Link to="/" className="landing-brand"><NiroLogo height={28} forceVariant={resolvedTheme} /><span>NIRO</span></Link><div className="landing-footer-links"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#security">Security</a><Link to="/login">Log in</Link></div><span className="landing-footer-copy">© {new Date().getFullYear()} Niro</span></div></footer>
      </div>
    </>
  );
}

function ProductConsole() { const bars = [28, 34, 26, 42, 84, 61, 47, 31]; return <div className="landing-console" aria-label="Niro risk intelligence preview"><div className="landing-console-bar"><span>Risk assessment · #TXN-8842</span><span className="landing-live"><i /> Live analysis</span></div><div className="landing-console-main"><section className="landing-panel"><div className="landing-transaction-head"><div><div className="landing-panel-kicker">Transaction risk</div><div className="landing-transaction-id">Payment review</div></div><div className="landing-score">78</div></div><div className="landing-transaction-details"><Detail label="Amount" value="$842.00" /><Detail label="Status" value="Review" /><Detail label="Merchant" value="ACME Store" /><Detail label="Method" value="Card" /></div><div className="landing-decision"><CircleAlert size={20} /><div><strong>Recommend review</strong>High-confidence risk signals detected.</div></div></section><section className="landing-panel landing-signals"><div><div className="landing-panel-kicker">Intelligence</div><h3>Why it needs attention</h3></div><Signal icon={Fingerprint} title="Device reuse" stat="3 accounts" /><Signal icon={Timer} title="Payment velocity" stat="Elevated" /><Signal icon={Network} title="Connected activity" stat="Clustered" /><div className="landing-signal-chart" aria-hidden="true">{bars.map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div></section></div></div> }
function Detail({ label, value }: {label:string; value:string}) { return <div className="landing-detail"><label>{label}</label><b>{value}</b></div> }
function Signal({ icon: Icon, title, stat }: {icon: typeof Activity; title:string; stat:string}) { return <div className="landing-signal"><span><Icon size={14} /></span><div><b>{title}</b><small>{stat}</small></div></div> }
function Proof({ icon: Icon, text }: {icon: typeof Activity; text:string}) { return <div className="landing-proof-item"><Icon /><span>{text}</span></div> }
function Problem({ number, title, copy }: {number:string; title:string; copy:string}) { return <article className="landing-problem"><span className="landing-problem-number">{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article> }
function Flow({ icon: Icon, title, copy }: {icon: typeof Activity; title:string; copy:string}) { return <article className="landing-flow-step"><div className="landing-flow-dot" /><Icon size={20} /><h3>{title}</h3><p>{copy}</p></article> }
function ShowcaseRow({ icon: Icon, name, sub, risk }: {icon: typeof Activity; name:string; sub:string; risk:string}) { return <div className="landing-showcase-row"><span><Icon size={17} /></span><div><b>{name}</b><small>{sub}</small></div><em className="landing-risk-chip">{risk}</em></div> }
function Security({ icon: Icon, title, text }: {icon: typeof Activity; title:string; text:string}) { return <article className="landing-security-line"><Icon size={19} /><div><b>{title}</b><p>{text}</p></div></article> }
