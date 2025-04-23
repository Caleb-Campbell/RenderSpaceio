import { checkoutAction, creditPurchaseAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';

// Prices are fresh for one hour max
export const revalidate = 3600;

// Credit packages configuration
const creditPackages = [
  {
    id: 'single',
    name: 'Single Render',
    credits: 1,
    price: 100, // $1.00
    features: [
      '1 high-quality render',
      'Full resolution download',
      'Save to your gallery'
    ]
  },
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 5,
    price: 400, // $4.00
    features: [
      '5 high-quality renders',
      'Full resolution downloads',
      'Save to your gallery',
      '20% discount per credit'
    ],
    popular: true
  },
  {
    id: 'professional',
    name: 'Professional Pack',
    credits: 10,
    price: 800, // $8.00
    features: [
      '10 high-quality renders',
      'Full resolution downloads',
      'Save to your gallery',
      '20% discount per credit'
    ]
  }
];

export default async function PricingPage() {
  // Fetch subscription products for future implementation
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
          Credits for Interior Design Visualization
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-gray-600">
          Choose the credit package that suits your needs. Each credit allows you to generate one high-quality AI render of your interior design concept.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {creditPackages.map((pkg) => (
          <CreditPackageCard
            key={pkg.id}
            name={pkg.name}
            credits={pkg.credits}
            price={pkg.price}
            features={pkg.features}
            popular={pkg.popular}
            packageId={pkg.id}
          />
        ))}
      </div>
      
      <div className="mt-16 border-t border-gray-200 pt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Frequently Asked Questions
        </h2>
        
        <div className="max-w-3xl mx-auto space-y-8">
          <FaqItem
            question="What can I do with my credits?"
            answer="Each credit allows you to generate one high-quality interior design visualization. Upload your design elements, select room type and lighting preferences, and our AI will create a realistic render for you."
          />
          
          <FaqItem
            question="Do credits expire?"
            answer="No, your credits never expire. Use them whenever you're ready to create a new visualization."
          />
          
          <FaqItem
            question="Can I get a refund for unused credits?"
            answer="Credits are non-refundable once purchased, but they never expire so you can use them anytime."
          />
          
          <FaqItem
            question="What resolution are the renders?"
            answer="All renders are generated at high resolution (1024x1024 pixels) to ensure your visualizations look professional and detailed."
          />
        </div>
      </div>
    </main>
  );
}

function CreditPackageCard({
  name,
  credits,
  price,
  features,
  popular,
  packageId,
}: {
  name: string;
  credits: number;
  price: number;
  features: string[];
  popular?: boolean;
  packageId: string;
}) {
  return (
    <div className={`rounded-xl border ${popular ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200'} bg-white shadow-sm overflow-hidden`}>
      {popular && (
        <div className="bg-orange-500 py-1 text-center text-sm font-medium text-white">
          Most Popular
        </div>
      )}
      
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{name}</h2>
        
        <div className="mt-4 mb-6">
          <p className="text-4xl font-bold text-gray-900">
            ${price / 100}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            for {credits} credit{credits > 1 ? 's' : ''}
            {credits > 1 && (
              <span className="font-medium text-orange-600 ml-1">
                (${(price / credits / 100).toFixed(2)} per credit)
              </span>
            )}
          </p>
        </div>
        
        <ul className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
        
        <form action={creditPurchaseAction}>
          <input type="hidden" name="packageId" value={packageId} />
          <input type="hidden" name="credits" value={credits.toString()} />
          <input type="hidden" name="price" value={price.toString()} />
          <SubmitButton className={popular ? 'bg-orange-500 hover:bg-orange-600' : ''} />
        </form>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900">{question}</h3>
      <p className="mt-2 text-gray-600">{answer}</p>
    </div>
  );
}