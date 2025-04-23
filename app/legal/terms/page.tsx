import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>

      <p className="mb-4">
        Welcome to RenderSpace! These terms and conditions outline the rules and regulations for the use of RenderSpace's Website, located at [Your Website URL].
      </p>

      <p className="mb-4">
        By accessing this website we assume you accept these terms and conditions. Do not continue to use RenderSpace if you do not agree to take all of the terms and conditions stated on this page.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Service Description</h2>
      <p className="mb-4">
        RenderSpace provides AI-powered image rendering services. Users can upload images and apply various transformations or styles.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Render Quality and Limitations</h2>
      <p className="mb-4">
        While we strive to provide high-quality renders, the nature of AI image generation means that results may not always be perfect or exactly as anticipated. Factors such as input image quality, complexity of the request, and inherent limitations of the AI models can affect the final output.
      </p>
      <p className="mb-4">
        Users acknowledge and agree that:
      </p>
      <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
        <li>Render results are provided on an "as is" basis.</li>
        <li>Minor imperfections, artifacts, or deviations from the prompt may occur.</li>
        <li>RenderSpace does not guarantee photorealistic or flawless results in every instance.</li>
        <li>We are continuously working to improve our models, but limitations exist.</li>
      </ul>
      <p className="mb-4">
        By using the service, you accept the potential for variability and imperfection in the generated renders.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">User Responsibilities</h2>
      <p className="mb-4">
        Users are responsible for the content they upload and the prompts they provide. You agree not to use the service for any unlawful purpose or to generate content that is harmful, offensive, or infringes on the rights of others.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Intellectual Property</h2>
      <p className="mb-4">
        You retain ownership of the original images you upload. RenderSpace retains rights to the underlying technology and AI models. The ownership of the generated renders is subject to the specific license terms presented during the rendering process or in your subscription plan.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Limitation of Liability</h2>
      <p className="mb-4">
        To the fullest extent permitted by applicable law, RenderSpace shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the service; (ii) any conduct or content of any third party on the service; (iii) any content obtained from the service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Changes to Terms</h2>
      <p className="mb-4">
        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
      </p>

      <h2 className="text-2xl font-semibold mt-6 mb-3">Contact Us</h2>
      <p className="mb-4">
        If you have any questions about these Terms, please contact us at [Your Support Email].
      </p>

      <div className="mt-8 text-center">
        <Link href="/" className="text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
