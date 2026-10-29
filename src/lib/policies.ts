/**
 * Starter policy text for the footer links. Plain, marketplace-specific wording that
 * the owner should review with their own adviser before launch.
 */
export const POLICIES: Record<string, { title: string; updated: string; sections: [string, string][] }> = {
  refund: {
    title: "Refund Policy",
    updated: "29 October 2026",
    sections: [
      ["Who sells what you buy", "iMaket is a marketplace. Each product is sold by an independent store (a creator), whose name is shown on the product page and your receipt. Refunds are handled between you and that store, and iMaket steps in if you can't reach an agreement."],
      ["Physical items", "If an item arrives damaged, faulty or not as described, message the store from your order page within 7 days of delivery with a photo. The store will offer a replacement, repair or refund. Unless the item was faulty, return delivery is at your cost and items must be unused with tags."],
      ["Downloads and courses", "Because digital files can't be returned, they're refundable only if the file is faulty, missing or materially different from its description, and you report it within 14 days of purchase."],
      ["Events and services", "Tickets and booked sessions follow the store's own cancellation terms shown on the product page. If an event is cancelled, you'll be refunded in full."],
      ["How refunds are paid", "Approved refunds go back to the original payment method (mobile money, card or PayPal). Mobile money refunds usually arrive within 3 business days; cards can take up to 10."],
      ["Need help?", "If a store doesn't respond within 3 business days, contact iMaket using the details in the footer and include your order number."],
    ],
  },
  shipping: {
    title: "Shipping Policy",
    updated: "29 October 2026",
    sections: [
      ["Who ships your order", "Each store packs and ships its own products, so items from different stores arrive separately. Delivery fees are shown on the product page and added at checkout."],
      ["When it ships", "Stores aim to dispatch within 3 business days of payment unless the product page says otherwise (for example, made-to-order items). You'll see the status and any tracking number on your order page."],
      ["Where we deliver", "Most stores deliver within their own country; some offer collection points or regional delivery. Check the product page for what applies."],
      ["Digital products", "Downloads, courses and tickets are delivered instantly to your library and by email as soon as payment clears."],
      ["Problems with delivery", "If your order hasn't arrived within the estimated time, message the store from your order page. Lost parcels are refunded or replaced by the store."],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    updated: "29 October 2026",
    sections: [
      ["About these terms", "These terms apply when you browse, buy or sell on iMaket. By creating an account or placing an order you agree to them."],
      ["Accounts", "You must give accurate details and keep your password safe. You're responsible for activity on your account. We may suspend accounts that break these terms or the law."],
      ["Buying", "When you buy, your contract is with the store selling the product. Prices are set by stores and charged in the currency shown. Payment is processed by our payment partners; iMaket never stores your full card details."],
      ["Selling", "Stores must own the rights to what they sell, describe products accurately, fulfil orders promptly and follow the Refund and Shipping policies. iMaket charges a commission on each sale, shown in your creator dashboard. Earnings become available after a short clearing period."],
      ["Discount codes", "Sitewide codes (such as newsletter or seasonal offers) apply to stores that take part in sitewide sales. Codes can't be exchanged for cash and may be withdrawn at any time."],
      ["Community", "Posts, comments and profiles in Groups and Members must be respectful and lawful. Don't share other people's personal details, spam or harass. We may remove content and accounts that don't follow these rules."],
      ["Liability", "iMaket provides the marketplace as is. To the extent the law allows, we aren't liable for indirect losses or for products sold by stores, but nothing here limits rights you have under consumer law."],
      ["Changes", "We may update these terms. If changes are significant we'll let account holders know by email."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "29 October 2026",
    sections: [
      ["What we collect", "Your name, email and password when you sign up; delivery address and phone number when you order; and what you buy, save or post. Payment providers collect payment details directly."],
      ["How we use it", "To run your account, process and deliver orders, show sellers what they need to fulfil them, prevent fraud, and send service emails. With your consent, we also send the newsletter. You can unsubscribe at any time."],
      ["What stores see", "A store sees the name, email and (for shipped items) delivery details on orders placed with it. Stores may not use them for anything other than fulfilling and supporting your order."],
      ["What other members see", "If your profile is public, other signed-in members can see your name, photo, short bio, store and follower count in the Members directory. You can hide your profile in account settings. Posts and comments in public groups are visible to anyone."],
      ["Where data is stored", "Data is stored with our hosting and database providers (Vercel and Supabase) in secure data centres, which may be outside your country."],
      ["Your rights", "You can view and update your details in account settings, download your data or ask us to delete your account by contacting us using the details in the footer."],
      ["Cookies", "We use essential cookies to keep you signed in and remember your cart, and a referral cookie when you arrive through an affiliate link."],
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    updated: "29 October 2026",
    sections: [
      ["Our commitment", "We want everyone to be able to shop, sell and take part in the iMaket community. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA."],
      ["What we've done", "Pages work with a keyboard and screen readers, images and buttons have text alternatives, text can be resized, and we respect your device's reduced-motion setting."],
      ["Known limitations", "Some product photos and descriptions are uploaded by stores and may lack detailed alternative text. Embedded content from payment providers is governed by their own accessibility standards."],
      ["Tell us", "If something isn't accessible to you, contact us using the details in the footer. Tell us the page and what went wrong and we'll work to fix it."],
    ],
  },
};

export const FAQ: [string, string][] = [
  ["What is iMaket?", "iMaket is a marketplace where independent creators sell clothing, prints, downloads, courses, event tickets and services from their own storefronts. You can shop from many stores in one checkout."],
  ["How do I pay?", "Pay with mobile money (MTN, Airtel, Zamtel, M-Pesa and more), card or PayPal, depending on the store's currency. You'll see the available options at checkout."],
  ["Where are my downloads?", "As soon as payment clears, digital items appear in My Library and we email you a link. Download links are secure and may have a download limit."],
  ["How do discount codes work?", "Enter the code at checkout. Sitewide codes (like the 10% newsletter code) work across taking-part stores; store codes work only for that store. One code per order."],
  ["Can I return something?", "Yes. Physical items can be returned within 7 days if damaged or not as described; see the Refund Policy for details and digital items."],
  ["How do I start selling?", "Choose “Sell on iMaket”, pick your store link, add a product and you're live. iMaket takes a small commission per sale and you withdraw earnings to mobile money or bank."],
  ["What are Groups and Members?", "Groups are community spaces to share drops, ask questions and chat. Members lets signed-in users find and follow creators and other shoppers. You can hide your profile any time."],
];
