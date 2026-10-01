import legalJson from './legal.json';

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

// The privacy policy and terms live in legal.json so the app and the public web pages
// (scripts/build-legal.js) always say the same thing.
export const APP_NAME: string = legalJson.appName;
export const LEGAL_UPDATED: string = legalJson.updated;
/** Where people can reach us. Empty until set in legal.json; the app hides the contact options while it is empty. */
export const SUPPORT_EMAIL: string = legalJson.supportEmail;
export const PRIVACY: LegalDocument = legalJson.privacy;
export const TERMS: LegalDocument = legalJson.terms;
