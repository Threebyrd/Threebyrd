import Image from "next/image";
import IngredientStory from "./components/IngredientStory";
import JoinForm from "./components/JoinForm";
import WeeklyPlans from "./components/WeeklyPlans";

const menuItems = [
  {
    id: "little-chicken",
    name: "Little Chicken",
    size: "Small size",
    protein: "46.5g",
    calories: "660",
    carbs: "77.5g",
    fat: "17g",
    price: "Price coming soon",
    image: "/assets/little-chicken.webp",
    alt: "Little Chicken meal prep boxes with rice and broccoli",
    type: "chicken",
    ingredients: "Chicken, white rice + broccoli",
    allergens: "Seasoning and allergen statement coming soon",
    macroScope: "Small Chicken macros",
  },
  {
    id: "big-chicken",
    name: "Big Chicken",
    size: "Big size",
    protein: "69g",
    calories: "970",
    carbs: "114g",
    fat: "26g",
    price: "Price coming soon",
    image: "/assets/big-chicken.webp",
    alt: "Big Chicken meal prep boxes with rice and broccoli",
    type: "chicken",
    ingredients: "Chicken, white rice + broccoli",
    allergens: "Seasoning and allergen statement coming soon",
    macroScope: "Big Chicken macros",
  },
  {
    id: "little-beef",
    name: "Little Beef",
    size: "Small size",
    protein: "66.5g",
    calories: "960",
    carbs: "77.5g",
    fat: "41g",
    price: "Price coming soon",
    image: "/assets/little-beef.webp",
    alt: "Little Beef meal prep boxes with rice and broccoli",
    type: "beef",
    ingredients: "Beef, white rice + broccoli",
    allergens: "Seasoning and allergen statement coming soon",
    macroScope: "Verified Beef macro set",
  },
  {
    id: "big-beef",
    name: "Big Beef",
    size: "Big size",
    protein: "66.5g",
    calories: "960",
    carbs: "77.5g",
    fat: "41g",
    price: "Price coming soon",
    image: "/assets/big-beef.webp",
    alt: "Big Beef meal prep boxes with rice and broccoli",
    type: "beef",
    ingredients: "Beef, white rice + broccoli",
    allergens: "Seasoning and allergen statement coming soon",
    macroScope: "Verified Beef macro set",
  },
];

const impactStats = [
  { value: "300+", label: "boxes donated" },
  { value: "$3,000+", label: "in meals given" },
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

const tickerItems = ["Small + Big", "Chicken + Beef", "3–20 meals weekly", "Rice + Broccoli"];

const navigation = [
  { label: "Plans", href: "#plans" },
  { label: "Menu", href: "#menu" },
  { label: "Story", href: "#story" },
  { label: "Giving Back", href: "#giving-back" },
  { label: "Team", href: "#team" },
];

export default function Home() {
  return (
    <>
      <a className="announcementBar" href="#join">
        <span>Online ordering opens soon</span>
        <strong>Get launch updates</strong>
        <span aria-hidden="true">→</span>
      </a>

      <header className="siteHeader" aria-label="Threebyrd Meal Prep">
        <a className="brandLockup" href="#top" aria-label="Threebyrd Meal Prep home">
          <Image
            src="/assets/threebyrd-wordmark-wide.webp"
            alt="Threebyrd Meal Prep"
            width={650}
            height={233}
            priority
          />
        </a>
        <nav className="navLinks" aria-label="Primary navigation">
          {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <a className="navCta" href="#join">Get Updates</a>
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
              <p className="heroKicker"><span>Threebyrd Meal Prep</span> Formerly SBX Chicken</p>
              <h1 id="hero-title">Threebyrd<br /><em>Meal Prep.</em></h1>
              <p className="heroLead">Chicken or beef. Little or Big.</p>
              <p className="heroNote">Rice, broccoli, and clearly listed macros in every box.</p>
              <div className="heroActions" aria-label="Main actions">
                <a className="button buttonPrimary" href="#plans">Choose a weekly plan</a>
                <a className="textLink" href="#menu">See the full menu <span aria-hidden="true">↓</span></a>
              </div>
              <dl className="heroProof" aria-label="Threebyrd at a glance">
                <div><dt>Big Chicken</dt><dd>69g protein</dd></div>
                <div><dt>Current menu</dt><dd>4 meal choices</dd></div>
                <div><dt>Founded in</dt><dd>Ithaca, NY</dd></div>
              </dl>
            </div>

            <div className="heroVisual">
              <div className="heroPhotoFrame">
                <Image
                  src="/assets/hero-meal.webp"
                  alt="Threebyrd chicken and beef meal prep boxes with rice and broccoli"
                  width={1000}
                  height={1333}
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  priority
                />
              </div>
              <span className="sticker stickerHero">3–20<small>meals / week</small></span>
              <span className="heroPhotoLabel">Chicken + Beef <b aria-hidden="true">★</b></span>
            </div>
          </div>
        </section>

        <div className="foodTicker">
          <p className="srOnly">Small and Big sizes, Chicken and Beef, 3 to 20 meals weekly, rice and broccoli.</p>
          <div className="tickerTrack" aria-hidden="true">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((item, index) => (
              <span key={`${item}-${index}`}>{item}<b>✦</b></span>
            ))}
          </div>
        </div>

        <section className="nutritionRail" aria-label="Threebyrd menu overview">
          <div><span>Sizes</span><strong>Small + Big</strong></div>
          <div><span>Weekly plans</span><strong>3–20 meals</strong></div>
          <div><span>Proteins</span><strong>Chicken + Beef</strong></div>
          <div><span>Every box</span><strong>Rice + Broccoli</strong></div>
        </section>

        <WeeklyPlans />

        <section id="menu" className="menuSection" aria-labelledby="menu-title">
          <div className="sectionShell">
            <div className="menuIntro">
              <div>
                <p className="sectionLabel">The Menu</p>
                <h2 id="menu-title">Four boxes.<br />No guesswork.</h2>
              </div>
              <div className="menuIntroCopy">
                <p>Chicken or beef. Little or Big. Every current box comes with rice and broccoli.</p>
                <p className="dataNote"><strong>Macro note:</strong> Beef nutrition reflects the one verified beef macro set for both displayed beef sizes.</p>
              </div>
            </div>

            <div className="menuGrid">
              {menuItems.map((item, index) => (
                <article className={`menuCard ${item.type}`} key={item.id}>
                  <div className="menuCardPhoto">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      width={720}
                      height={960}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    <span>0{index + 1} / {item.size}</span>
                  </div>
                  <div className="menuCardBody">
                    <div className="menuCardHeading">
                      <h3>{item.name}</h3>
                      <p>{item.price}</p>
                    </div>

                    <div className="cardNutrition" aria-label={`${item.name} nutrition information`}>
                      <h4>{item.macroScope}</h4>
                      <div className="macroGrid">
                        <div><span>Calories</span><strong>{item.calories}</strong></div>
                        <div className="macroProtein"><span>Protein</span><strong>{item.protein}</strong></div>
                        <div><span>Carbs</span><strong>{item.carbs}</strong></div>
                        <div><span>Fat</span><strong>{item.fat}</strong></div>
                      </div>
                    </div>

                    <div className="cardIngredients">
                      <h4>In the box</h4>
                      <p>{item.ingredients}</p>
                      <span>{item.allergens}</span>
                    </div>
                    <a className="cardCta" href="#join">Get opening updates <span aria-hidden="true">→</span></a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="processSection" aria-labelledby="process-title">
          <div className="sectionShell">
            <p className="sectionLabel sectionLabelLight">How Your Week Works</p>
            <h2 id="process-title">Two choices.<br />One simpler week.</h2>
            <div className="processGrid">
              <article className="processCard processCardOne">
                <div className="processCopy">
                  <span>01</span>
                  <h3>Choose your meal.</h3>
                  <p>Pick Chicken or Beef, then choose a Little or Big portion.</p>
                  <a href="#menu">Explore four meals <span aria-hidden="true">→</span></a>
                </div>
                <Image src="/assets/little-chicken.webp" alt="Little Chicken meal prep boxes" width={720} height={960} />
              </article>
              <article className="processCard processCardTwo">
                <div className="processCopy">
                  <span>02</span>
                  <h3>Choose your week.</h3>
                  <p>Select 3, 5, 10, or 20 meals. Pricing will be added when it is finalized.</p>
                  <a href="#plans">See weekly plans <span aria-hidden="true">→</span></a>
                </div>
                <Image src="/assets/hero-meal.webp" alt="A row of Threebyrd meal prep boxes" width={1000} height={1333} />
              </article>
            </div>
          </div>
        </section>

        <IngredientStory />

        <section id="giving-back" className="givingSection" aria-labelledby="giving-title">
          <div className="sectionShell">
            <div className="givingTop">
              <div>
                <p className="sectionLabel sectionLabelLight">Giving Back</p>
                <h2 id="giving-title">Meals made for Ithaca.</h2>
              </div>
              <p>With support from two on-campus organizations at Cornell University, Threebyrd held two large meal giveaways with Friendship Donations Network and Ithaca Catholic Worker House.</p>
            </div>

            <div className="impactRow">
              {impactStats.map((stat) => (
                <div className="impactStat" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="pressBlock" aria-labelledby="press-title">
              <div className="pressHeading">
                <span>Local proof</span>
                <h3 id="press-title">In the news</h3>
              </div>
              <div className="pressList">
                {pressLinks.map((press) => (
                  <a href={press.href} key={press.href} target="_blank" rel="noreferrer">
                    <span>{press.source}</span>
                    <div><strong>{press.title}</strong><p>{press.summary}</p></div>
                    <small>{press.date} <b aria-hidden="true">↗</b></small>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="story" className="storySection" aria-labelledby="story-title">
          <div className="sectionShell">
            <div className="storyHeading">
              <p className="sectionLabel">Our Story</p>
              <h2 id="story-title">From SBX Chicken<br />to Threebyrd.</h2>
              <p>A student-founded meal-prep project is becoming a broader brand for busy weeks.</p>
            </div>
            <div className="storyGrid">
              <article>
                <div className="storyPhoto"><Image src="/assets/big-chicken.webp" alt="Big Chicken meal prep boxes" width={720} height={960} /></div>
                <span>Then / SBX Chicken</span>
                <h3>Started with meal prep.</h3>
                <p>Thor, Truman, and Luc began by cooking straightforward meal-prep boxes while they were students at Cornell.</p>
              </article>
              <article>
                <div className="storyPhoto"><Image src="/assets/hero-meal.webp" alt="Chicken and beef meal prep boxes arranged on a table" width={1000} height={1333} /></div>
                <span>The menu / kept simple</span>
                <h3>Built around four choices.</h3>
                <p>Chicken or beef, two portion sizes, rice, and broccoli remain at the center of the current menu.</p>
              </article>
              <article>
                <div className="storyPhoto"><Image src="/assets/little-beef.webp" alt="Little Beef meal prep boxes" width={720} height={960} /></div>
                <span>Now / Threebyrd</span>
                <h3>Getting ready for what is next.</h3>
                <p>Threebyrd is the next version of the idea, with online ordering and weekly meal options on the way.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="team" className="teamSection" aria-labelledby="team-title">
          <div className="sectionShell">
            <div className="teamHeading">
              <p className="sectionLabel">Meet The Team</p>
              <h2 id="team-title">Three founders.<br />One Threebyrd.</h2>
            </div>
            <div className="teamGrid">
              {founders.map((founder, index) => (
                <article className="founderCard" key={founder.name}>
                  <span>0{index + 1}</span>
                  <Image src={founder.image} alt={founder.alt} width={founder.width} height={founder.height} />
                  <div><h3>{founder.name}</h3><p>{founder.role}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="join" className="joinSection" aria-labelledby="join-title">
          <div className="sectionShell joinLayout">
            <div className="joinContent">
              <p className="sectionLabel sectionLabelLight">Opening Soon</p>
              <h2 id="join-title">Be first at the table.</h2>
              <p>Leave your email, phone number, or both. We will send the menu and ordering details when they are ready.</p>
            </div>
            <JoinForm />
          </div>
        </section>
      </main>

      <footer className="siteFooter">
        <div className="footerTop">
          <Image src="/assets/threebyrd-wordmark-wide.webp" alt="Threebyrd Meal Prep" width={650} height={233} />
          <nav aria-label="Footer navigation">
            {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
            <a href="#join">Get Updates</a>
          </nav>
        </div>
        <div className="footerBottom">
          <p>Threebyrd Meal Prep, formerly SBX Chicken.</p>
          <p>Ithaca, New York · Opening updates coming soon</p>
        </div>
      </footer>
    </>
  );
}
