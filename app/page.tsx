import Image from "next/image";
import MealScene from "./components/MealScene";

const launchForm = {
  provider: "pending",
  action: "",
};

const menuItems = [
  {
    id: "little-chicken",
    name: "Little Chicken",
    protein: "~60g",
    calories: "~800",
    carbs: "Coming soon",
    fat: "Coming soon",
    price: "Price coming soon",
    image: "/assets/little-chicken.jpg",
    width: 1050,
    height: 1400,
    alt: "Little chicken meal prep boxes with rice and broccoli",
    type: "chicken",
    ingredients: "Seasoned chicken, white rice, broccoli",
    allergens: "Final allergen statement coming soon",
  },
  {
    id: "big-chicken",
    name: "Big Chicken",
    protein: "~70g",
    calories: "~970",
    carbs: "~114g",
    fat: "~26g",
    price: "Price coming soon",
    image: "/assets/big-chicken.jpg",
    width: 1050,
    height: 1400,
    alt: "Big chicken meal prep boxes with rice and broccoli",
    type: "chicken",
    ingredients: "Seasoned chicken, white rice, broccoli",
    allergens: "Final allergen statement coming soon",
  },
  {
    id: "little-beef",
    name: "Little Beef",
    protein: "Coming soon",
    calories: "Coming soon",
    carbs: "Coming soon",
    fat: "Coming soon",
    price: "Price coming soon",
    image: "/assets/little-beef.jpg",
    width: 1050,
    height: 1400,
    alt: "Little beef meal prep boxes with rice and broccoli",
    type: "beef",
    ingredients: "Seasoned beef, white rice, broccoli",
    allergens: "Final allergen statement coming soon",
  },
  {
    id: "big-beef",
    name: "Big Beef",
    protein: "Coming soon",
    calories: "Coming soon",
    carbs: "Coming soon",
    fat: "Coming soon",
    price: "Price coming soon",
    image: "/assets/big-beef.jpg",
    width: 1050,
    height: 1400,
    alt: "Big beef meal prep boxes with rice and broccoli",
    type: "beef",
    ingredients: "Seasoned beef, white rice, broccoli",
    allergens: "Final allergen statement coming soon",
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
    image: "/assets/thor-waguespack.jpg",
    width: 800,
    height: 1200,
    alt: "Headshot of Thor Waguespack",
  },
  {
    name: "Truman Popp",
    role: "Co-Founder",
    image: "/assets/truman-popp.jpg",
    width: 628,
    height: 630,
    alt: "Headshot of Truman Popp",
  },
  {
    name: "Luc Surprenant",
    role: "Co-Founder",
    image: "/assets/luc-surprenant.jpg",
    width: 1200,
    height: 900,
    alt: "Headshot of Luc Surprenant",
  },
];

const pressLinks = [
  {
    source: "WBNG",
    title: "Cornell students to distribute 200 free meals Saturday",
    date: "April 30, 2026",
    href: "https://www.wbng.com/2026/04/30/cornell-students-distribute-200-free-meals-saturday/",
  },
  {
    source: "14850",
    title: "Cornell student meal-prep startup offering free meals",
    date: "May 2026",
    href: "https://www.14850.com/050145866-cornell-sbx-chicken-giveaway/",
  },
];

const tickerItems = ["Chicken", "Beef", "Rice", "Broccoli", "Little", "Big"];

export default function Home() {
  return (
    <main>
      <header className="siteHeader" aria-label="Threebyrd Meal Prep">
        <a className="brandLockup" href="#top" aria-label="Threebyrd Meal Prep home">
          <Image
            src="/assets/threebyrd-wordmark-wide.png"
            alt="Threebyrd Meal Prep"
            width={1254}
            height={450}
            priority
          />
        </a>
        <nav className="navLinks" aria-label="Primary navigation">
          <a href="#menu">Menu</a>
          <a href="#story">Our Story</a>
          <a href="#giving-back">Giving Back</a>
          <a href="#team">Team</a>
        </nav>
        <a className="navCta" href="#join">Get Updates</a>
      </header>

      <section id="top" className="hero" aria-labelledby="hero-title">
        <MealScene />
        <div className="heroCubeLabel" aria-hidden="true">
          <span>01</span>
          <strong>Actual Threebyrd chicken</strong>
        </div>
        <div className="heroLines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="heroContent">
          <p className="heroKicker">Formerly SBX Chicken</p>
          <h1 id="hero-title">Threebyrd Meal Prep</h1>
          <p className="heroLead">Chicken or beef. Little or Big.</p>
          <p className="heroNote">Rice, broccoli, and clearly listed macros in every box.</p>
          <div className="heroActions" aria-label="Main actions">
            <a className="button buttonGold" href="#menu">See the Menu</a>
            <a className="button buttonOutline" href="#join">Get Opening Updates</a>
          </div>
        </div>
        <div className="heroReadout" aria-label="Big Chicken nutrition preview">
          <span>Big Chicken</span>
          <div>
            <p><small>Protein</small><strong>~70g</strong></p>
            <p><small>Calories</small><strong>~970</strong></p>
          </div>
        </div>
      </section>

      <div className="foodTicker" aria-label="Menu ingredients and choices">
        <div className="tickerTrack">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}<b aria-hidden="true">*</b></span>
          ))}
        </div>
      </div>

      <section className="nutritionRail" aria-label="Threebyrd menu overview">
        <div>
          <span>Chicken protein</span>
          <strong>~60-70g</strong>
        </div>
        <div>
          <span>Menu</span>
          <strong>4 boxes</strong>
        </div>
        <div>
          <span>Proteins</span>
          <strong>Chicken + beef</strong>
        </div>
        <div>
          <span>Every box</span>
          <strong>Rice + broccoli</strong>
        </div>
      </section>

      <section id="menu" className="menuSection" aria-labelledby="menu-title">
        <div className="menuIntro">
          <p className="sectionLabel">The Menu</p>
          <h2 id="menu-title">Pick your box.</h2>
          <p>Chicken or beef. Little or Big. Every box comes with rice and broccoli.</p>
        </div>

        <div className="menuGrid">
          {menuItems.map((item, index) => (
            <article className={`menuCard ${item.type}`} key={item.id}>
              <div className="menuCardPhoto">
                <Image
                  src={item.image}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  sizes="(max-width: 600px) 100vw, (max-width: 1120px) 50vw, 25vw"
                />
                <span>Box {index + 1}</span>
              </div>
              <div className="menuCardBody">
                <div className="menuCardHeading">
                  <h3>{item.name}</h3>
                  <p>{item.price}</p>
                </div>

                <div className="cardNutrition" aria-label={`${item.name} nutrition information`}>
                  <h4>Macros</h4>
                  <div className="macroGrid">
                    <div>
                      <span>Calories</span>
                      <strong>{item.calories}</strong>
                    </div>
                    <div>
                      <span>Protein</span>
                      <strong>{item.protein}</strong>
                    </div>
                    <div>
                      <span>Carbs</span>
                      <strong>{item.carbs}</strong>
                    </div>
                    <div>
                      <span>Fat</span>
                      <strong>{item.fat}</strong>
                    </div>
                  </div>
                </div>

                <div className="cardIngredients">
                  <h4>Ingredients</h4>
                  <p>{item.ingredients}</p>
                  <span>{item.allergens}</span>
                </div>

                <a href="#join">Get opening updates</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="howSection" aria-labelledby="how-title">
        <div className="howHeading">
          <p className="sectionLabel">How It Works</p>
          <h2 id="how-title">Three steps. That is it.</h2>
        </div>
        <ol className="howSteps">
          <li><span>1</span><strong>Choose</strong><p>Chicken or beef. Little or Big.</p></li>
          <li><span>2</span><strong>Heat</strong><p>Keep the boxes ready in your fridge.</p></li>
          <li><span>3</span><strong>Eat</strong><p>Lunch or dinner is ready when you are.</p></li>
        </ol>
      </section>

      <section id="story" className="storySection" aria-labelledby="story-title">
        <div className="storyPhotos" aria-label="Threebyrd chicken and beef meals">
          <Image src="/assets/big-chicken.jpg" alt="Chicken meal prep boxes" width={1050} height={1400} />
          <Image src="/assets/little-beef.jpg" alt="Beef meal prep boxes" width={1050} height={1400} />
        </div>
        <div className="storyCopy">
          <p className="sectionLabel">Our Story</p>
          <h2 id="story-title">Threebyrd, formerly SBX Chicken.</h2>
          <p>
            Thor, Truman, and Luc started by cooking meal prep boxes while they were students at Cornell.
            The menu is still straightforward: chicken or beef, two portion sizes, rice, and broccoli.
          </p>
          <p>
            Threebyrd is the next version of that idea, with online ordering and weekly meal options on the way.
          </p>
        </div>
      </section>

      <section id="giving-back" className="givingSection" aria-labelledby="giving-title">
        <div className="givingTop">
          <div>
            <p className="sectionLabel">Giving Back</p>
            <h2 id="giving-title">More than 300 boxes donated in Ithaca.</h2>
          </div>
          <p>
            With support from two on-campus organizations at Cornell University, Threebyrd held two large
            meal giveaways with Friendship Donations Network and Ithaca Catholic Worker House.
          </p>
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
          <h3 id="press-title">In the news</h3>
          <div className="pressList">
            {pressLinks.map((press) => (
              <a href={press.href} key={press.href} target="_blank" rel="noreferrer">
                <span>{press.source}</span>
                <strong>{press.title}</strong>
                <small>{press.date}</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="team" className="teamSection" aria-labelledby="team-title">
        <div className="teamHeading">
          <p className="sectionLabel">Meet the Team</p>
          <h2 id="team-title">Thor, Truman, and Luc.</h2>
        </div>
        <div className="teamGrid">
          {founders.map((founder) => (
            <article className="founderCard" key={founder.name}>
              <Image src={founder.image} alt={founder.alt} width={founder.width} height={founder.height} />
              <div>
                <h3>{founder.name}</h3>
                <p>{founder.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="join" className="joinSection" aria-labelledby="join-title">
        <div className="joinContent">
          <p className="sectionLabel">Opening Soon</p>
          <h2 id="join-title">Get the opening menu.</h2>
          <p>Leave your email, phone number, or both. We will send the menu and ordering details when they are ready.</p>
        </div>
        <form className="joinForm" data-provider={launchForm.provider} data-action={launchForm.action}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" placeholder="(555) 555-5555" autoComplete="tel" />
          </div>
          <button type="button" disabled>List opening soon</button>
          <p>The sign-up form will be connected before online ordering opens.</p>
        </form>
      </section>

      <footer className="siteFooter">
        <Image src="/assets/threebyrd-wordmark-wide.png" alt="Threebyrd Meal Prep" width={1254} height={450} />
        <nav aria-label="Footer navigation">
          <a href="#menu">Menu</a>
          <a href="#story">Our Story</a>
          <a href="#giving-back">Giving Back</a>
          <a href="#team">Team</a>
        </nav>
        <p>Threebyrd Meal Prep, formerly SBX Chicken. Ithaca, New York.</p>
      </footer>
    </main>
  );
}
