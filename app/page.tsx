import Image from "next/image";
import Countdown from "./components/Countdown";
import CountUpTotal from "./components/CountUpTotal";
import JoinForm from "./components/JoinForm";
import OrderBuilder from "./components/OrderBuilder";
import {
  formatBusinessDateTime,
  getNextOrderCutoff,
  getSaturdayForCutoff,
} from "./order-config";

const impactStats = [
  { value: "300+", label: "boxes donated" },
  { value: "$3,000", label: "in meals given", countUp: true },
  { value: "2", label: "large giveaways" },
];

const founders = [
  {
    name: "Thor Waguespack",
    role: "Co-Founder",
    image: "/assets/thor-waguespack.webp",
    width: 640,
    height: 960,
    alt: "Headshot of Thor Waguespack",
  },
  {
    name: "Truman Popp",
    role: "Co-Founder",
    image: "/assets/truman-popp.webp",
    width: 640,
    height: 640,
    alt: "Headshot of Truman Popp",
  },
  {
    name: "Luc Surprenant",
    role: "Co-Founder",
    image: "/assets/luc-surprenant.webp",
    width: 506,
    height: 675,
    alt: "Headshot of Luc Surprenant",
  },
];

const pressLinks = [
  {
    source: "WBNG",
    title: "Cornell students to distribute 200 free meals Saturday",
    summary: "Coverage of a planned 200-meal Ithaca giveaway and an earlier 110-meal event.",
    date: "Apr. 30, 2026",
    href: "https://www.wbng.com/2026/04/30/cornell-students-distribute-200-free-meals-saturday/",
  },
  {
    source: "14850",
    title: "Cornell student meal-prep startup offering free meals",
    summary: "Local coverage of the student-founded meal-prep project and its community giveaway.",
    date: "May 2026",
    href: "https://www.14850.com/050145866-cornell-sbx-chicken-giveaway/",
  },
];

const navigation = [
  { label: "Order", href: "#order" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Giving Back", href: "#giving-back" },
  { label: "Team", href: "#team" },
];

const cutoff = getNextOrderCutoff();

export default function Home() {
  return (
    <>
      <a className="announcementBar" href="#order">
        <span>Delivery only</span>
        <strong>Build a one-time order · 3-box minimum</strong>
        <span aria-hidden="true">→</span>
      </a>

      <header className="siteHeader" aria-label="ThreeByrd Meal Prep">
        <a className="brandLockup" href="#top" aria-label="ThreeByrd Meal Prep home">
          <Image
            src="/assets/threebyrd-logo.png"
            alt="ThreeByrd Meal Prep full logo"
            width={3938}
            height={2591}
            priority
          />
        </a>
        <nav className="navLinks" aria-label="Primary navigation">
          {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <a className="navCta" href="#order">Build your order</a>
        <details className="mobileMenu">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
        </details>
      </header>

      <main>
        <section id="top" className="hero" aria-labelledby="hero-title">
          <div className="sectionShell heroLayout">
            <div className="heroContent">
              <p className="heroKicker"><span>ThreeByrd Meal Prep</span> Formerly SBX Chicken</p>
              <h1 className="majorHeading" id="hero-title">Choose<br /><em>your protein.</em></h1>
              <p className="heroLead">Chicken or Beef. Little or Big.</p>
              <p className="heroNote">Simple, high-protein meal prep with rice and broccoli, delivered straight to your door.</p>
              <div className="heroChoiceRow" aria-label="Protein choices">
                <span>Chicken</span><b aria-hidden="true">+</b><span>Beef</span>
              </div>
              <div className="heroActions" aria-label="Main actions">
                <a className="button buttonPrimary" href="#order">Choose Meal Order <span aria-hidden="true">→</span></a>
                <a className="textLink" href="#how-it-works">How ordering works <span aria-hidden="true">↓</span></a>
              </div>
              <dl className="heroProof" aria-label="ThreeByrd at a glance">
                <div><dt>Delivery</dt><dd>To your door</dd></div>
                <div><dt>Minimum</dt><dd>3 boxes</dd></div>
                <div><dt>Cook day</dt><dd>Saturday</dd></div>
              </dl>
            </div>

            <div className="heroVisual">
              <div className="heroPhotoFrame">
                <Image
                  src="/assets/hero-meal.webp"
                  alt="ThreeByrd Chicken and Beef meal prep boxes with rice and broccoli"
                  width={1000}
                  height={1333}
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  priority
                />
              </div>
              <span className="sticker stickerHero">Door-to-door<small>meal prep</small></span>
              <span className="heroPhotoLabel">Chicken + Beef <b aria-hidden="true">★</b></span>
            </div>
          </div>
        </section>

        <div className="foodTicker">
          <p className="srOnly">Chicken and Beef, Little and Big, delivered to your door, rice and broccoli, three-box minimum.</p>
          <div className="tickerTrack" aria-hidden="true">
            {[0, 1].map((sequence) => (
              <div className="tickerSequence" key={sequence}>
                {["Chicken + Beef", "Little + Big", "Delivered to your door", "Rice + Broccoli", "3-box minimum"].map((item) => (
                  <span key={`${sequence}-${item}`}>{item}<b>✦</b></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="upperJoinSection" aria-labelledby="upper-join-title">
          <div className="sectionShell upperJoinLayout">
            <div className="upperJoinContent">
              <p className="sectionLabel">Stay in the loop</p>
              <h2 className="majorHeading" id="upper-join-title">Be first to know when ordering opens.</h2>
              <p>Leave your email, phone number, or both for ordering and delivery updates.</p>
            </div>
            <JoinForm idPrefix="upper-join" compact />
          </div>
        </section>

        <Countdown initialCutoffIso={cutoff.toISOString()} />
        <OrderBuilder initialCutoffIso={cutoff.toISOString()} />

        <section id="how-it-works" className="processSection" aria-labelledby="process-title">
          <div className="sectionShell">
            <p className="sectionLabel sectionLabelLight">How ordering works</p>
            <h2 className="majorHeading" id="process-title">Pick your build.<br />We handle the rest.</h2>
            <div className="processGrid">
              <article className="processCard processCardOne">
                <div className="processCopy"><span>01</span><h3>Pick your protein.</h3><p>Choose Chicken or Beef, then choose a Little or Big box.</p><a href="#order">Choose Chicken or Beef <span aria-hidden="true">→</span></a></div>
                <Image className="processImage processImageOne" src="/assets/big-chicken.webp" alt="Big Chicken meal prep boxes" width={720} height={960} />
              </article>
              <article className="processCard processCardTwo">
                <div className="processCopy"><span>02</span><h3>Pick your quantity.</h3><p>Mix and match three or more boxes. Each SKU earns its own 5+ quantity price.</p><a href="#order">Build your order <span aria-hidden="true">→</span></a></div>
                <Image className="processImage processImageTwo" src="/assets/little-chicken.webp" alt="Little Chicken meal prep boxes" width={720} height={960} />
              </article>
              <article className="processCard processCardThree">
                <div className="processCopy"><span>03</span><h3>We cook.</h3><p>Checkout securely and we prepare your order for Saturday kitchen day.</p></div>
                <Image className="processImage processImageThree" src="/assets/big-beef.webp" alt="Big Beef meal prep boxes with rice and broccoli" width={720} height={960} />
              </article>
              <article className="processCard processCardFour">
                <div className="processCopy"><span>04</span><h3>Delivered to your door.</h3><p>Your meals arrive Saturday. Delivery only—there is no pickup option.</p></div>
                <Image className="processImage processImageFour" src="/assets/little-chicken.webp" alt="Little Chicken meal prep boxes ready for delivery" width={720} height={960} />
              </article>
            </div>
          </div>
        </section>

        <section id="giving-back" className="givingSection" aria-labelledby="giving-title">
          <div className="sectionShell">
            <div className="givingTop">
              <div><p className="sectionLabel sectionLabelLight">Giving back</p><h2 className="majorHeading" id="giving-title">Meals made for Ithaca.</h2></div>
              <p>With support from two on-campus organizations at Cornell University, ThreeByrd held two large meal giveaways with Friendship Donations Network and Ithaca Catholic Worker House.</p>
            </div>
            <div className="impactRow">{impactStats.map((stat) => <div className="impactStat" key={stat.label}>{stat.countUp ? <CountUpTotal /> : <strong>{stat.value}</strong>}<span>{stat.label}</span></div>)}</div>
            <div className="pressBlock" aria-labelledby="press-title">
              <div className="pressHeading"><span>Local proof</span><h3 id="press-title">In the news</h3></div>
              <div className="pressList">{pressLinks.map((press) => <a href={press.href} key={press.href} target="_blank" rel="noreferrer"><span>{press.source}</span><div><strong>{press.title}</strong><p>{press.summary}</p></div><small>{press.date} <b aria-hidden="true">↗</b></small></a>)}</div>
            </div>
          </div>
        </section>

        <section id="story" className="storySection" aria-labelledby="story-title">
          <div className="sectionShell">
            <div className="storyHeading"><p className="sectionLabel">Our story</p><h2 className="majorHeading" id="story-title">From SBX Chicken<br />to ThreeByrd.</h2><p>A student-founded meal-prep project becoming a broader brand for busy weeks, with delivery built in.</p></div>
            <div className="storyGrid">
              <article><div className="storyPhoto"><Image src="/assets/big-chicken.webp" alt="Big Chicken meal prep boxes" width={720} height={960} /></div><span>Then / SBX Chicken</span><h3>Started with meal prep.</h3><p>Thor, Truman, and Luc began by cooking straightforward meal-prep boxes while they were students at Cornell.</p></article>
              <article><div className="storyPhoto"><Image src="/assets/hero-meal.webp" alt="Chicken and Beef meal prep boxes arranged on a table" width={1000} height={1333} /></div><span>The menu / kept simple</span><h3>Built around four choices.</h3><p>Chicken or Beef, two portion sizes, rice, and broccoli remain at the center of the menu.</p></article>
              <article><div className="storyPhoto"><Image src="/assets/little-beef.webp" alt="Little Beef meal prep boxes" width={720} height={960} /></div><span>Now / ThreeByrd</span><h3>Delivered for busy days.</h3><p>Order the mix that fits your week, then let ThreeByrd handle cooking and Saturday delivery.</p></article>
            </div>
          </div>
        </section>

        <section id="team" className="teamSection" aria-labelledby="team-title">
          <div className="sectionShell"><div className="teamHeading"><p className="sectionLabel">Meet the team</p><h2 className="majorHeading" id="team-title">Three founders.<br />One ThreeByrd.</h2></div><div className="teamGrid">{founders.map((founder, index) => <article className="founderCard" key={founder.name}><span>0{index + 1}</span><Image className={founder.name === "Thor Waguespack" ? "founderImageThor" : undefined} src={founder.image} alt={founder.alt} width={founder.width} height={founder.height} /><div><h3>{founder.name}</h3><p>{founder.role}</p></div></article>)}</div></div>
        </section>

        <section id="join" className="joinSection" aria-labelledby="join-title">
          <div className="sectionShell joinLayout"><div className="joinContent"><p className="sectionLabel sectionLabelLight">Stay in the loop</p><h2 className="majorHeading" id="join-title">Be first at the table.</h2><p>Leave your email, phone number, or both. We will share menu and delivery updates as ThreeByrd grows.</p></div><div className="joinAside"><JoinForm idPrefix="bottom-join" /><div className="socialLinks" aria-label="ThreeByrd social links"><a aria-label="Follow ThreeByrd on Instagram" href="https://www.instagram.com/threebyrd/" target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg><span>Follow ThreeByrd on Instagram</span></a><a aria-label="Follow ThreeByrd on LinkedIn" href="https://www.linkedin.com/company/threebyrd/" target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10.2v6.3M8 7.7v.1M11.5 16.5v-3.4a2.3 2.3 0 0 1 4.6 0v3.4M11.5 10.2v6.3" /></svg><span>Follow ThreeByrd on LinkedIn</span></a></div></div></div>
        </section>
      </main>

      <footer className="siteFooter">
        <div className="footerTop"><Image src="/assets/threebyrd-logo.png" alt="ThreeByrd Meal Prep official logo" width={3938} height={2591} /><nav aria-label="Footer navigation">{navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}<a href="#join">Get updates</a></nav></div>
        <div className="footerBottom"><p>ThreeByrd Meal Prep, formerly SBX Chicken.</p><p>Ithaca, New York · Delivery only</p><p className="footerCutoff">Orders close {formatBusinessDateTime(cutoff)} · next cook {getSaturdayForCutoff(cutoff)}</p><p className="footerContact">For inquiries, contact <a href="mailto:thor@threebyrd.com">thor@threebyrd.com</a></p></div>
      </footer>
    </>
  );
}
