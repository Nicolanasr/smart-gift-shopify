import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData, Link } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    if (url.searchParams.get("shop")) {
        throw redirect(`/app?${url.searchParams.toString()}`);
    }
    return { showForm: Boolean(login) };
};

export default function LandingPage() {
    const { showForm } = useLoaderData<typeof loader>();

    return (
        <div className={styles.landingPage}>
            <div className={styles.container}>
                {/* Navigation */}
                <nav className={styles.nav}>
                    <Link to="/" className={styles.logo}>
                        🎁 Smart Gift
                    </Link>
                    <a href="#login" className={styles.loginBtn}>Merchant Login</a>
                </nav>

                {/* Hero Section */}
                <section className={styles.hero}>
                    <div className={styles.heroContent}>
                        <h1 className={styles.heading}>The Ultimate Gifting Experience for Shopify</h1>
                        <p className={styles.subheading}>
                            Empower your customers to send video messages, schedule digital delivery, and create unforgettable unboxing moments.
                        </p>

                        <div className={styles.ctaGroup} id="login">
                            {showForm && (
                                <div className={styles.form}>
                                    <Form method="post" action="/auth/login">
                                        <label className={styles.label}>
                                            <span>Enter your shop domain to install</span>
                                            <input
                                                className={styles.input}
                                                type="text"
                                                name="shop"
                                                placeholder="my-store.myshopify.com"
                                                required
                                            />
                                        </label>
                                        <button className={styles.installBtn} type="submit">
                                            Install Free
                                        </button>
                                    </Form>
                                </div>
                            )}
                        </div>

                        <p style={{ fontSize: '0.9rem', color: '#6d7175' }}>
                            Already installed? Enter your domain above to login.
                        </p>
                    </div>
                </section>
            </div>

            {/* Features Grid */}
            <section className={styles.features}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Why Top Brands Choose Smart Gift</h2>
                    <div className={styles.grid}>
                        <div className={styles.featureCard}>
                            <span className={styles.featureIcon}>🎥</span>
                            <h3 className={styles.featureTitle}>Video Messages</h3>
                            <p className={styles.featureText}>Let customers record personal video greetings that recipients watch upon delivery.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <span className={styles.featureIcon}>📅</span>
                            <h3 className={styles.featureTitle}>Scheduled Delivery</h3>
                            <p className={styles.featureText}>Perfect timing, every time. Gifts arrive in the inbox exactly when they should.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <span className={styles.featureIcon}>🎧</span>
                            <h3 className={styles.featureTitle}>Multi-Format Support</h3>
                            <p className={styles.featureText}>Support for audio, video, images, and text. A truly flexible gifting suite.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className={styles.howItWorks}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>How It Works</h2>
                    <div className={styles.steps}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>1</div>
                            <h3>Customer Buys</h3>
                            <p>Shopper selects "Send as a Gift" on your product page.</p>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <h3>Personalizes</h3>
                            <p>They record a video message or write a note instantly.</p>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>3</div>
                            <h3>Delivered</h3>
                            <p>Recipient gets a beautiful email or QR code to unwrap their digital experience.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section className={styles.pricing}>
                <div className={styles.container}>
                    <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
                    <div className={styles.pricingGrid}>
                        {/* Free Plan */}
                        <div className={styles.pricingCard}>
                            <h3 className={styles.planTitle}>Starter</h3>
                            <div className={styles.price}>Free</div>
                            <div className={styles.frequency}>forever</div>
                            <ul className={styles.planFeatures}>
                                <li>25 free media uploads/mo</li>
                                <li>Video & Audio support</li>
                                <li>QR Code generation</li>
                                <li>Standard email delivery</li>
                            </ul>
                            <a href="#login" className={styles.loginBtn}>Get Started</a>
                        </div>

                        {/* Pro Plan */}
                        <div className={`${styles.pricingCard} ${styles.highlight}`}>
                            <div className={styles.badge}>MOST POPULAR</div>
                            <h3 className={styles.planTitle}>Pro Gifting</h3>
                            <div className={styles.price}>$14.99</div>
                            <div className={styles.frequency}>/month</div>
                            <ul className={styles.planFeatures}>
                                <li>100 free media uploads/mo</li>
                                <li>Priority support</li>
                                <li>Custom branding</li>
                                <li>Advanced analytics</li>
                            </ul>
                            <a href="#login" className={styles.primaryBtn}>Start 14-Day Trial</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.container}>
                    <p>&copy; {new Date().getFullYear()} Smart Gift App. Built for Shopify Merchants.</p>
                </div>
            </footer>
        </div>
    );
}
