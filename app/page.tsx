import Image from "next/image";
import CountUpTotal from "./components/CountUpTotal";
import CutoffNotice from "./components/CutoffNotice";
import HeroCarousel from "./components/HeroCarousel";
import JoinForm from "./components/JoinForm";
import MobileMenu from "./components/MobileMenu";
import OrderBuilder from "./components/OrderBuilder";
import {
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
    email: "thor@threebyrd.com",
    linkedin: "https://www.linkedin.com/in/thorbw/",
  },
  {
    name: "Truman Popp",
    role: "Co-Founder",
    email: "truman@threebyrd.com",
    linkedin: "https://www.linkedin.com/in/trumanpopp/",
  },
  {
    name: "Luc Surprenant",
    role: "Co-Founder",
    email: "luc@threebyrd.com",
    linkedin: "https://www.linkedin.com/in/lucsurprenant/",
  },
];

const pressLinks = [
  {
    source: "WBNG",
    title: "Cornell students to distribute 200 free meals Saturday",
    date: "Apr. 30, 2026",
    href: "https://www.wbng.com/2026/04/30/cornell-students-distribute-200-free-meals-saturday/",
  },
  {
    source: "14850",
    title: "Cornell student meal-prep startup offering free meals",
    date: "May 2026",
    href: "https://www.14850.com/050145866-cornell-sbx-chicken-giveaway/",
  },
];

const navigation = [
  { label: "Order", href: "#order" },
  { label: "Giving Back", href: "#giving-back" },
  { label: "Team", href: "#team" },
];

const cutoff = getNextOrderCutoff();
const deliveryDay = getSaturdayForCutoff(cutoff);

export default function Home() {
  return (
    <>
      <a className="announcementBar" href="#order">
        <span>Free delivery in Ithaca</span>
        <strong>Build your order · 3 meal minimum</strong>
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
        <MobileMenu items={navigation} />
      </header>

      <main>
        <section id="top" className="hero" aria-labelledby="hero-title">
          <div className="sectionShell heroLayout">
            <div className="heroContent">
              <h1 className="majorHeading" id="hero-title">High-protein<br /><em>meal prep.</em><br />Delivered free in Ithaca.</h1>
              <p className="heroLead">Chicken or beef. Little or big.</p>
              <div className="heroActions" aria-label="Main actions">
                <a className="button buttonPrimary" href="#order">Build your order <span aria-hidden="true">→</span></a>
              </div>
              <dl className="heroProof" aria-label="ThreeByrd at a glance">
                <div><dt>Delivery</dt><dd>Free in Ithaca</dd></div>
                <div><dt>Minimum</dt><dd>3 meals</dd></div>
                <div><dt>Delivery day</dt><dd>{deliveryDay.replace(/,.*/, "")}</dd></div>
              </dl>
            </div>

            <div className="heroVisual">
              <div className="heroPhotoFrame"><HeroCarousel /></div>
              <span className="sticker stickerHero">Free delivery<small>Ithaca only</small></span>
              <span className="heroPhotoLabel">Chicken + Beef <b aria-hidden="true">★</b></span>
            </div>
          </div>
        </section>

        <OrderBuilder initialCutoffIso={cutoff.toISOString()} />

        <section id="join" className="joinSection" aria-labelledby="join-title">
          <div className="sectionShell joinLayout"><div className="joinContent"><p className="sectionLabel sectionLabelLight">Stay in the loop</p><h2 className="majorHeading" id="join-title">Get the next drop.</h2><p>Menu and delivery updates, straight to you.</p></div><div className="joinAside"><JoinForm idPrefix="bottom-join" /><div className="socialLinks" aria-label="ThreeByrd social links"><a aria-label="Follow ThreeByrd on Instagram" href="https://www.instagram.com/threebyrd/" target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg><span>Follow ThreeByrd on Instagram</span></a><a aria-label="Follow ThreeByrd on LinkedIn" href="https://www.linkedin.com/company/threebyrd/" target="_blank" rel="noopener noreferrer"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10.2v6.3M8 7.7v.1M11.5 16.5v-3.4a2.3 2.3 0 0 1 4.6 0v3.4M11.5 10.2v6.3" /></svg><span>Follow ThreeByrd on LinkedIn</span></a></div></div></div>
        </section>

        <section id="giving-back" className="givingSection" aria-labelledby="giving-title">
          <div className="sectionShell">
            <div className="givingTop">
              <div><p className="sectionLabel sectionLabelLight">Giving back</p><h2 className="majorHeading" id="giving-title">Meals made for Ithaca.</h2></div>
              <p>ThreeByrd gives back with Cornell community partners.</p>
            </div>
            <div className="impactRow">{impactStats.map((stat) => <div className="impactStat" key={stat.label}>{stat.countUp ? <CountUpTotal /> : <strong>{stat.value}</strong>}<span>{stat.label}</span></div>)}</div>
            <div className="pressBlock" aria-labelledby="press-title">
              <div className="pressHeading"><span>Local proof</span><h3 id="press-title">In the news</h3></div>
              <div className="pressList">{pressLinks.map((press) => <a href={press.href} key={press.href} target="_blank" rel="noreferrer"><span>{press.source}</span><div><strong>{press.title}</strong></div><small>{press.date} <b aria-hidden="true">↗</b></small></a>)}</div>
            </div>
          </div>
        </section>

        <section id="team" className="teamSection" aria-labelledby="team-title">
          <div className="sectionShell">
            <div className="teamHeading"><p className="sectionLabel">Meet the team</p><h2 className="majorHeading" id="team-title">Three founders.<br />One ThreeByrd.</h2></div>
            <div className="teamFeature">
              <div className="teamPhotoFrame">
                <Image src="/assets/threebyrd-team.webp" alt="ThreeByrd co-founders Thor Waguespack, Truman Popp, and Luc Surprenant" width={1800} height={1200} sizes="(max-width: 1024px) 100vw, 60vw" />
              </div>
              <div className="teamRoster">
                {founders.map((founder) => (
                  <article className="teamMember" key={founder.name}>
                    <h3>{founder.name}</h3>
                    <p>{founder.role}</p>
                    <div className="founderContacts">
                      <a className="founderContactLink" href={`mailto:${founder.email}`}>{founder.email}</a>
                      <a className="founderContactLink founderLinkedIn" href={founder.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${founder.name} on LinkedIn`}>
                        <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10.2v6.3M8 7.7v.1M11.5 16.5v-3.4a2.3 2.3 0 0 1 4.6 0v3.4M11.5 10.2v6.3" /></svg><span>LinkedIn</span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="siteFooter">
        <div className="footerTop"><Image src="/assets/threebyrd-logo.png" alt="ThreeByrd Meal Prep official logo" width={3938} height={2591} /><nav aria-label="Footer navigation">{navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}<a href="#join">Get updates</a></nav></div>
        <div className="footerBottom"><p>ThreeByrd Meal Prep, formerly SBX Chicken.</p><p>Ithaca, New York · Delivery only</p><CutoffNotice initialCutoffIso={cutoff.toISOString()} /><p className="footerContact">For inquiries, contact <a href="mailto:thor@threebyrd.com">thor@threebyrd.com</a></p></div>
      </footer>
    </>
  );
}
