import { getUncachableStripeClient } from './stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const products = [
    {
      name: 'Raw Funded — $50 Account',
      amount: 5000,
      metadata: { tier: 'bronze', buyingPower: '2500', accountSize: '50' },
    },
    {
      name: 'Raw Funded — $200 Account',
      amount: 20000,
      metadata: { tier: 'silver', buyingPower: '12500', accountSize: '200' },
    },
    {
      name: 'Raw Funded — $1,000 Account',
      amount: 100000,
      metadata: { tier: 'gold', buyingPower: '62500', accountSize: '1000' },
    },
  ];

  for (const p of products) {
    const existing = await stripe.products.search({ query: `name:'${p.name}'` });
    if (existing.data.length > 0) {
      console.log(`Product already exists: ${p.name} (${existing.data[0].id})`);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      if (prices.data.length > 0) {
        console.log(`  Price: ${prices.data[0].id} ($${prices.data[0].unit_amount! / 100})`);
      }
      continue;
    }

    const product = await stripe.products.create({
      name: p.name,
      metadata: p.metadata,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.amount,
      currency: 'usd',
    });

    console.log(`Created: ${p.name} -> Product: ${product.id}, Price: ${price.id}`);
  }

  console.log('Done seeding products.');
}

seedProducts().catch(console.error);
