# Buy My Bio

Build a completely new standalone web application called:

BUY MY BIO

Domain:
buymybio.com

This is a FRESH BUILD.

Do not reuse, modify, fork, or depend on any existing application.

Create fresh infrastructure including:

- frontend
- Supabase database
- authentication
- Stripe integration
- Stripe Connect architecture for future creator payouts
- bidding system
- redirect system
- click tracking
- admin dashboard
- creator listings
- X account connection / verification
- transactional emails

==================================================
PRODUCT CONCEPT
==================================================

Buy My Bio is a marketplace where people can bid to own the sponsored link in someone's social media bio.

The core mechanic:

CREATOR:
Lists their social bio for sale.

BUYER:
Pays more than the current owner.

RESULT:
The buyer's website becomes the destination of the creator's BuyMyBio link.

They keep ownership until somebody pays more.

The simplest explanation is:

"Buy the link in someone's bio."

And:

"Highest bidder owns it until they're outbid."

The product should feel like an internet game/experiment rather than an advertising SaaS platform.

Think:

- Outbid-style competition
- creator economy
- public price discovery
- status
- scarcity
- extremely simple mechanics
- public ownership
- transparent history
- shareable wins

The entire product should be understandable in approximately five seconds.

==================================================
IMPORTANT PRODUCT MODEL
==================================================

We are NOT selling control of someone's entire social media bio.

We are selling the destination behind ONE permanent BuyMyBio link placed in their bio.

Example:

Alex puts:

buymybio.com/alex

in his X bio.

Startup A buys Alex's bio.

buymybio.com/alex

now redirects to:

startup-a.com

Startup B outbids Startup A.

The creator does NOT need to edit their X bio.

BuyMyBio automatically changes the redirect:

buymybio.com/alex

→ startup-b.com

This permanent redirect architecture is fundamental to the product.

==================================================
LAUNCH STRATEGY
==================================================

Architect the application to support multiple creators.

However, the initial public launch will feature ONLY:

Alex MacGregor
@amacg

as the first creator/listing.

Do not fill the marketplace with fake creators.

Do not create fake listings.

Do not create fake bids.

Do not create fake clicks.

Do not create fake revenue.

Do not create fake testimonials.

The homepage should feel intentional even when Alex is the only creator.

Once validated, additional creators can onboard using the creator onboarding flow described below.

==================================================
HOMEPAGE
==================================================

Make the homepage extremely minimal.

HEADER

Left:

Buy My Bio

Right:

How It Works
History
Sell Your Bio

Do not create a large SaaS navigation bar.

==================================================
HERO
==================================================

Large headline:

BUY MY BIO

Primary headline:

Buy the link in my bio.

Subheadline:

Highest bidder owns it until they're outbid.

Show a large social-profile-style representation of:

Alex MacGregor
@amacg

Bio:

Building startups in public and documenting the process.

Show:

buymybio.com/alex

with a small annotation:

↑ This is what you're buying

Do NOT pretend this is an official X embed.

It can reference the visual language of social profiles while clearly remaining BuyMyBio UI.

==================================================
CURRENT OWNER
==================================================

Prominently show:

CURRENT OWNER

[logo]

[Startup / Brand]

CURRENT PRICE

$XX

DESTINATION

domain.com

CLICKS

XXX

Then:

TAKE MY BIO — $XX

Underneath:

Pay more. Take the link. Keep it until someone outbids you.

The price and CTA should dominate the page.

==================================================
STARTING PRICE
==================================================

Alex's starting price:

$10

If nobody owns the bio:

CURRENT OWNER

Available

STARTING PRICE

$10

CTA:

BUY MY BIO — $10

After the first purchase, each takeover must cost at least 10% more than the previous purchase.

Round UP to the nearest whole dollar.

Examples:

$10 → $11
$11 → $13
$13 → $15
$50 → $55
$55 → $61
$100 → $110

Calculate the required amount SERVER-SIDE.

Never trust a bid amount supplied by the browser.

Make the minimum increase percentage configurable in admin.

==================================================
BUY FLOW
==================================================

Clicking:

TAKE MY BIO — $XX

opens a simple purchase flow.

Ask for:

Startup / Brand Name
Required

Destination URL
Required

Email
Required

X Handle
Optional

Logo
Optional

Show:

Current owner:
[NAME]

Current price:
$XX

Your takeover price:

$XX

Primary CTA:

Take the bio — $XX

Include:

[ ] I agree to the Terms and understand destinations are subject to moderation.

Proceed to Stripe Checkout.

==================================================
PAYMENT RULE
==================================================

A form submission is NOT a bid.

A checkout session is NOT a bid.

Only a successfully verified payment creates ownership.

Use Stripe Checkout and Stripe webhooks.

After successful payment:

1. Verify payment server-side.
2. Verify amount.
3. Verify listing.
4. Verify that the purchase price is still valid.
5. Create successful bid/ownership record.
6. End previous ownership period.
7. Make buyer current owner.
8. Change redirect destination.
9. Record takeover timestamp.
10. Trigger transactional emails.
11. Send buyer to success page.

==================================================
RACE CONDITIONS
==================================================

This is critical.

Two people may attempt to purchase the same bio simultaneously.

There must only ever be ONE current owner.

Use database transactions/locking/constraints where appropriate.

The database is the source of truth.

If Buyer A completes a valid $100 takeover before Buyer B completes their stale $100 checkout:

Buyer B must NOT become owner.

Never allow two successful ownership records for the same state.

Flag stale completed payments in admin and provide a safe workflow for refund/resolution.

Do not silently lose payments.

==================================================
REDIRECT SYSTEM
==================================================

Each creator receives a permanent public redirect URL:

buymybio.com/[username]

Alex:

buymybio.com/alex

When someone visits the URL:

1. Identify the current owner.
2. Record click.
3. Attribute click to the correct ownership period.
4. Redirect immediately to the current owner's destination.

The redirect should be extremely fast.

If no current owner exists, redirect to that creator's BuyMyBio listing/profile rather than an external destination.

Validate destination URLs.

Only allow safe HTTPS destinations.

Protect against open redirect abuse.

==================================================
SUCCESS PAGE
==================================================

After a successful takeover:

YOU OWN MY BIO.

Subheadline:

Until somebody pays more.

Show:

You paid:
$XX

Your startup:
[NAME]

Destination:
[DOMAIN]

Previous owner:
[NAME]

Then create a strong shareable ownership card:

I bought @amacg's bio for $XX.

Buttons:

SHARE ON X

COPY LINK

Pre-populated X post:

I just bought @amacg's bio for $XX.

[BuyMyBio ownership URL]

Make successful ownership feel like something worth bragging about.

==================================================
OUTBID EMAIL
==================================================

When an owner is replaced, email them.

Subject:

You've been outbid.

Email:

Someone just bought @amacg's bio from you.

You paid:
$XX

New price:
$XX

You owned it for:
[duration]

Clicks received:
[click count]

CTA:

TAKE IT BACK — $XX

The CTA should return them directly to the listing.

This is an important re-engagement loop.

==================================================
WINNER EMAIL
==================================================

After a successful takeover:

Subject:

You own @amacg's bio.

Include:

Amount paid
Destination
Current ownership status
BuyMyBio listing URL
Share on X CTA

Keep emails simple and playful.

Use Resend for transactional emails.

==================================================
PUBLIC HISTORY
==================================================

Below the main experience:

PREVIOUS OWNERS

Show:

Owner
Paid
Owned for
Clicks

Most recent first.

Example structure ONLY — do not populate fake data:

Acme
$120
3d 4h
1,204 clicks

Historical ownership records must remain after somebody is outbid.

This history is part of the product.

It creates:

- social proof
- competition
- price discovery
- transparency

==================================================
HOW IT WORKS
==================================================

Keep this extremely short.

1. BUY

Pay more than the current owner.

2. OWN

Your website becomes the destination of the bio link.

3. GET OUTBID

Someone pays more and takes it.

Then:

No deadline.
No expiry.
Highest bidder owns it.

==================================================
CREATOR MARKETPLACE ARCHITECTURE
==================================================

Build the underlying database so multiple creators can exist.

Each creator should have:

id
user_id
display_name
username
profile_image
bio
social_platform
social_handle
social_profile_url
follower_count if available
buy_my_bio_slug
starting_price
minimum_increase_percentage
current_owner_id
listing_status
verification_status
stripe_connect_status
created_at
updated_at

However:

DO NOT populate fake creators.

Alex is the only public creator initially.

==================================================
SELL YOUR BIO
==================================================

Create a /sell page.

Headline:

SELL YOUR BIO

Subheadline:

Turn the link in your social bio into an auction.

Explain simply:

1. Connect your account.
2. Add your BuyMyBio link.
3. Set your starting price.
4. Buyers compete for the link.
5. You earn when your bio sells.

CTA:

CONNECT X

==================================================
X CONNECTION
==================================================

Implement X OAuth using the current supported X authentication/API approach.

Creator clicks:

CONNECT X

Authenticate them.

Retrieve where permitted:

X user ID
username
display name
profile image
profile URL
follower count

Store the X user ID as the authoritative account identifier.

Do not rely solely on username because usernames can change.

If the current X API/access level does not permit a specific field, gracefully omit it rather than inventing data.

==================================================
CREATOR VERIFICATION
==================================================

Connecting X alone does NOT make a listing active.

After connecting X:

Generate the creator's permanent URL:

buymybio.com/[username]

Tell them:

Add this link to your X bio/profile:

buymybio.com/[username]

Then:

VERIFY MY BIO

BuyMyBio should verify, using available authorized X API/profile data where technically permitted, that the required BuyMyBio URL is present in the relevant public profile URL/bio field.

If automated verification is not available under the configured X API access, support an admin/manual verification fallback.

Never falsely show a listing as verified.

Only VERIFIED listings can accept purchases.

==================================================
ONGOING CREATOR VERIFICATION
==================================================

Design for periodic verification that the creator continues to display the required BuyMyBio link.

Store:

last_verified_at
verification_status
verification_failure_count

Possible statuses:

pending
verified
missing
suspended

If the link disappears:

Do NOT automatically continue presenting the listing as healthy.

Mark it for review/suspension according to platform rules.

Do not automatically promise buyer refunds or creator forfeitures until payout/refund rules have been formally configured.

Surface the issue clearly in admin.

==================================================
CREATOR PAYOUTS
==================================================

Architect for Stripe Connect.

Do NOT implement unsafe manual marketplace payouts.

Future marketplace economics:

Buyer pays purchase price.

Platform keeps a configurable platform fee.

Default planned platform fee:

20%

Creator share:

80%

However, for Alex's initial listing:

Alex is the platform owner.

No creator payout is necessary.

The platform keeps the revenue.

Build database fields/configuration so Stripe Connect payouts can be enabled later without redesigning the ownership model.

Do NOT block initial launch on Stripe Connect if it adds significant complexity.

==================================================
FUTURE SOCIAL PLATFORMS
==================================================

The database should use a platform field rather than hardcoding every listing as X.

Initial supported platform:

X

Future potential platforms:

Instagram
TikTok
YouTube
LinkedIn
Twitch
others

DO NOT implement these integrations now.

Do not add non-functional platform buttons.

The UI should simply say X at launch.

==================================================
CREATOR PROFILE/LISTING PAGE
==================================================

Architect:

buymybio.com/[username]

as both the creator's permanent BuyMyBio identity and redirect.

IMPORTANT:

If the creator has an active owner:

The URL should perform the tracked redirect.

Therefore create a separate listing URL such as:

buymybio.com/u/[username]

for viewing/bidding.

Example:

buymybio.com/alex
→ tracked advertiser redirect

buymybio.com/u/alex
→ Alex's BuyMyBio auction/listing page

This distinction is important.

==================================================
CLICK TRACKING
==================================================

For every ownership period track:

total clicks
unique clicks where reasonably measurable
referrer where available
timestamp
ownership_id
creator_id

Do not collect unnecessary personal information.

Historical clicks must remain attached to the owner who generated them.

When ownership changes, the new owner begins at zero clicks.

==================================================
ADMIN
==================================================

Create a protected /admin dashboard.

ADMIN OVERVIEW

Show:

Current owner
Current price
Next takeover price
Total revenue
Successful takeovers
Total clicks
Average takeover price

LISTINGS

Show:

creator
platform
handle
verification status
starting price
current owner
current price
clicks
status

BIDS / PURCHASES

Show:

buyer
email
company
destination
amount
Stripe payment ID
payment status
ownership status
created at
clicks

CREATORS

Show:

creator
connected X account
verification
BuyMyBio link
last verified
listing status
Stripe Connect status

==================================================
ADMIN ACTIONS
==================================================

Allow admin to:

approve/reject listing
verify creator manually
suspend listing
disable malicious destination
edit company name
edit destination
edit logo
change starting price
change minimum increase percentage
change platform fee
review payment
flag stale payment
mark refund status
restore safe redirect
ban buyer
ban creator

All sensitive admin actions must be protected server-side.

==================================================
MODERATION
==================================================

Buyers cannot link to:

malware
phishing
scams
illegal content
explicit adult content
extremist/hate content
gambling
impersonation
political campaigning
deceptive destinations
anything reasonably harmful to the creator or BuyMyBio

Creators/platform administrators retain moderation rights.

If an active destination is disabled:

Do NOT continue redirecting traffic to it.

Fall back to the creator's listing page:

buymybio.com/u/[username]

==================================================
DATABASE
==================================================

Use Supabase.

Design normalized tables approximately around:

users
creators
social_accounts
listings
buyers
ownerships
payments
clicks
verification_checks
platform_settings

Do not blindly follow these names if a cleaner relational model is appropriate.

Important ownership fields should include:

id
listing_id
buyer_id
company_name
destination_url
logo_url
amount_paid
payment_id
started_at
ended_at
status
click_count
created_at

Enforce at database level where possible:

ONLY ONE ACTIVE OWNERSHIP PER LISTING.

Use appropriate unique/partial constraints or transactional logic.

==================================================
AUTHENTICATION
==================================================

Buyers should NOT need to create an account just to purchase a bio.

Keep buying extremely low-friction.

Creator accounts require authentication because creators manage listings and eventually payouts.

Admin requires secure authentication.

==================================================
DESIGN
==================================================

Make this visually distinctive but extremely minimal.

Style:

internet-native
playful
bold
competitive
slightly absurd
clean
trustworthy

Use:

white/light background
dark typography
large typography
strong borders
generous whitespace
large current price
large CTA

The homepage should NOT look like a conventional SaaS website.

Avoid:

gradient-heavy design
feature grids
stock photography
generic illustrations
AI imagery
testimonial carousels
enterprise language
complex navigation
unnecessary animations
huge footer
dozens of cards

The bidding mechanic IS the product.

Desktop should show almost the entire important experience above the fold.

Mobile must be excellent.

==================================================
COPY STYLE
==================================================

Keep copy extremely short.

Prefer:

Buy my bio.
Take my bio.
You own it.
You've been outbid.
Take it back.
Someone paid more.
Own the link.

Avoid:

"Unlock the power of creator monetization"

"Revolutionize your social presence"

"Connect brands with creators"

or any generic startup/AI marketing language.

This should sound like an internet game.

==================================================
SEO
==================================================

Homepage title:

Buy My Bio — Buy the Link in Someone's Bio

Meta description:

Bid to own the link in someone's social media bio. Pay more than the current owner and it's yours until you're outbid.

Create proper:

canonical URLs
robots.txt
sitemap
structured metadata where appropriate
Open Graph metadata
X sharing metadata

==================================================
SHARE PAGES
==================================================

Successful ownership should have a shareable URL/page.

Example copy:

Acme bought @amacg's bio for $250.

Include:

creator
buyer
amount
current ownership status
CTA to view the auction

Generate strong dynamic Open Graph metadata for these pages.

The sharing loop is a core growth mechanism.

==================================================
ANALYTICS
==================================================

Track:

homepage_view
listing_view
buy_clicked
checkout_started
checkout_completed
redirect_clicked
share_clicked
sell_clicked
x_connect_started
creator_verified

Admin analytics:

total revenue
total successful purchases
average purchase
highest purchase
total clicks
number of creators
verified creators
active listings

==================================================
LEGAL
==================================================

Create concise:

Terms of Service
Privacy Policy

Terms should clearly explain:

- buyers purchase temporary ownership of a redirect destination, not ownership/control of the creator's social account
- ownership lasts until a valid higher purchase replaces it
- no guaranteed minimum exposure duration unless explicitly stated
- click counts are informational and no traffic level is guaranteed
- destinations are subject to moderation
- fraudulent/prohibited destinations may be removed
- payments/refunds are governed by the platform terms
- creators must maintain the required BuyMyBio placement while their listing is active

Do not make unsupported legal claims.

==================================================
CRITICAL V1 SCOPE
==================================================

The application architecture may support multiple creators.

But initial launch experience should remain incredibly focused:

Alex's X bio
One link
One current owner
One price
One button

DO NOT let future marketplace functionality make the homepage complicated.

The first visitor experience should essentially be:

BUY MY BIO

Highest bidder owns the link in my bio until they're outbid.

CURRENT OWNER
[Startup]

$55

TAKE MY BIO — $61

That's it.

==================================================
BUILD ORDER
==================================================

Implement in this order:

1. Database schema
2. Alex listing
3. Permanent /alex redirect
4. Homepage/listing UI
5. Purchase form
6. Stripe Checkout
7. Verified webhook ownership change
8. Race-condition protection
9. Click tracking
10. Ownership history
11. Success/share flow
12. Transactional emails
13. Admin
14. Creator authentication
15. X connection
16. Creator verification
17. /sell onboarding
18. Stripe Connect-ready architecture
19. SEO/social metadata
20. final mobile/responsive QA

Do not move on to marketplace polish before the core Alex purchase → ownership → redirect flow works end-to-end.

==================================================
FINAL QA
==================================================

Before declaring the build complete, test:

- first $10 purchase
- correct next-price calculation
- successful Stripe payment
- failed payment
- abandoned checkout
- two simultaneous checkout attempts
- stale checkout completing
- ownership replacement
- previous owner history
- outbid email
- redirect change
- click attribution before/after ownership change
- malicious/invalid destination
- admin destination suspension
- no-owner state
- mobile checkout flow
- share link/card
- creator X connection
- creator verification
- creator removing required link

Do not mark functionality complete simply because the UI exists.

Verify the actual database/payment/redirect behavior.

==================================================
FINAL PRINCIPLE
==================================================

Do not overbuild this.

BuyMyBio succeeds or fails on one loop:

SEE WHO OWNS IT
↓
PAY MORE
↓
OWN IT
↓
SHARE IT
↓
GET OUTBID
↓
BUY IT BACK

Everything in the product should strengthen that loop.

One bio.
One owner.
Pay more.
Take it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bid-my-bio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0b3f0557-3f1e-40cf-a958-013c348d4609).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
