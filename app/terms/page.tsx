'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-lg max-w-none bg-white rounded-lg shadow-sm p-8">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700">
              By accessing and using MSDrills Research Tools, you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Use License</h2>
            <p className="text-gray-700 mb-4">
              Permission is granted to temporarily use MSDrills Research Tools for personal, non-commercial
              research purposes. This license does not include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Commercial use or resale of the service</li>
              <li>Modification or copying of materials</li>
              <li>Use of the service for any unlawful purpose</li>
              <li>Attempting to reverse engineer or hack the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
            <p className="text-gray-700 mb-4">
              When you create an account with us, you must provide accurate and complete information. You are
              responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Maintaining the security of your account and password</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. User Content</h2>
            <p className="text-gray-700">
              You retain ownership of all research data and content you create using MSDrills. You grant us
              a license to store, process, and display your content solely for the purpose of providing the
              service to you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Service Availability</h2>
            <p className="text-gray-700">
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation.
              We reserve the right to modify, suspend, or discontinue any part of the service at any time
              without prior notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Limitation of Liability</h2>
            <p className="text-gray-700">
              MSDrills is provided "as is" without warranties of any kind. We shall not be liable for any
              indirect, incidental, special, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Changes to Terms</h2>
            <p className="text-gray-700">
              We reserve the right to modify these terms at any time. Continued use of the service after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Contact Information</h2>
            <p className="text-gray-700">
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@masteringseries.com" className="text-blue-600 hover:underline">
                support@masteringseries.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

