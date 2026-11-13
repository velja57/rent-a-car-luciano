import { companyLine, FACTS, joinList } from './facts';

// Rental terms and privacy policy — English (same content as sr.js).
const f = FACTS;
const c = { ...f.company, address: f.company.address.replace('Beograd', 'Belgrade') };
const UPDATED = '14 November 2026';
const firm = companyLine({ pib: 'tax ID (PIB)', mb: 'registration no. (MB)' }, c.address);
const olderCars = joinList(f.olderDriverCars.map((car) => `${car.name} (${car.minAge} years)`), 'and');
const depositCars = joinList(f.depositCars.map((car) => `${car.name} (€${car.deposit})`), 'and');

export const terms = {
  eyebrow: 'Legal information',
  title: ['Rental ', 'terms'],
  updated: UPDATED,
  intro: [
    `These terms apply to every vehicle rental with ${c.name}, whether you booked on the website, by phone, on WhatsApp or in person. Together with the rental agreement we sign when you pick up the car, they form one agreement. If the rental agreement and these terms differ, the rental agreement prevails.`,
    `Provider: ${firm}. Contact: +381 ${f.phone.slice(1)}, ${c.email}.`,
  ],
  sections: [
    {
      id: 'who-can-rent',
      title: 'Who can rent and drive',
      blocks: [
        `You can rent and drive a car if you are at least ${f.minAge} years old and hold a valid category B driving licence.${olderCars ? ` Some vehicles require a higher age: ${olderCars}. The requirement is also shown on each vehicle page.` : ''} We do not require a minimum number of years of driving experience.`,
        'At pick-up, please show your ID card or passport and your driving licence. Foreign nationals may drive with a licence valid in the Republic of Serbia; if your licence is not issued in the Latin alphabet, we recommend also bringing an International Driving Permit.',
        'Only the drivers named in the rental agreement may drive the car. We may refuse to hand over the car if the conditions are not met, for example if the documents do not match the booking details.',
      ],
    },
    {
      id: 'booking',
      title: 'Booking',
      blocks: [
        'An online booking is recorded immediately and you receive a confirmation by email. Nothing is paid when you book.',
        `Online bookings can be made for up to ${f.maxOnlineDays} days. For longer rentals or special requests, please call us.`,
        'If the chosen car is unavailable for a valid reason (e.g. a breakdown), we will offer you a car of the same or a higher class on the same terms. If the replacement does not suit you, the booking is cancelled at no cost to you.',
      ],
    },
    {
      id: 'pick-up',
      title: 'Pick-up and return',
      blocks: [
        `Online bookings are picked up and returned on weekdays (Monday–Friday) from ${f.hoursFrom}:00 to ${f.hoursTo}:00 at ${c.address}. Other times (weekends, early morning, late evening) are possible by arrangement over the phone, at no extra charge.`,
        'We deliver and collect the car at Nikola Tesla Airport free of charge and, by arrangement, at your address in Belgrade.',
        'At pick-up we inspect the car together and record any existing damage and the fuel level in the rental agreement. If you notice damage that has not been recorded, let us know before you drive off.',
        'Return the car to the agreed place at the agreed time, with the keys, documents and equipment it had at pick-up.',
        'After each rental we prepare the car for the next customer, so it may be booked again a few hours after your return time. Please keep to the agreed time.',
      ],
    },
    {
      id: 'duration',
      title: 'Rental period and late return',
      blocks: [
        'A rental day is 24 hours from the time of pick-up.',
        `You have a ${f.graceMinutes}-minute grace period for the return. After that, each started 24-hour period counts as an additional rental day at the price-list rate.`,
        'If you want to extend the rental, contact us before it ends. An extension is possible if the car is not booked by another customer.',
        'If you return the car before the agreed time, the rental price is not reduced.',
        'If the car is not returned on time and we cannot reach you, we will notify the competent authorities.',
      ],
    },
    {
      id: 'price',
      title: 'Price and payment',
      blocks: [
        'The daily rate depends on the car and the length of the rental; the long-rental discount is applied automatically. The price shown when you booked applies to your booking.',
        'The price includes basic insurance, unlimited mileage and, in the winter season, winter tyres. The child seat and airport delivery are free. Other extras (full insurance, travel outside Serbia) are charged as per the price list on the website.',
        `From your third rental with us, as a regular customer you get an extra ${f.loyaltyDiscount}% off the car rental price. The discount is applied at pick-up, to the price after the long-rental discount, and does not apply to extras.`,
        'The full rental amount is paid at pick-up, in cash or by card. Nothing is paid in advance.',
        'Prices are in euros; the amount in dinars shown on the website is for information only.',
      ],
    },
    {
      id: 'deposit',
      title: 'Deposit',
      blocks: depositCars
        ? [
            `Most of our cars require no deposit. A deposit is paid at pick-up only for the following cars: ${depositCars}. The amount is also shown on the vehicle page.`,
            'We return the deposit when you return the car, less only the costs set out in these terms (e.g. missing fuel or your share of damage).',
          ]
        : ['We do not require a deposit.'],
    },
    {
      id: 'cancellation',
      title: 'Cancelling or changing a booking',
      blocks: [
        `You can cancel or change your booking free of charge up to ${f.freeCancellationHours} hours before pick-up — by phone, WhatsApp or email.`,
        'Since nothing is paid when you book, there is nothing to refund when you cancel.',
        'If you do not show up at the agreed time and do not contact us, the booking is cancelled and the car may be rented to another customer.',
      ],
    },
    {
      id: 'fuel',
      title: 'Fuel',
      blocks: [
        'Return the car with the same fuel level as at pick-up; the level is recorded in the rental agreement. If there is less fuel, we charge for the missing fuel at the current fuel price.',
        'The fuel type is stated in the vehicle description. Costs and damage caused by filling up with the wrong fuel are borne by the renter.',
      ],
    },
    {
      id: 'use',
      title: 'Use of the vehicle',
      blocks: [
        'Use the car carefully, in line with traffic regulations and the manufacturer’s instructions. The following is not allowed:',
        [
          'driving under the influence of alcohol, drugs or medication that affects your ability to drive;',
          'letting anyone not named in the rental agreement drive the car;',
          'carrying passengers or goods for payment, or renting the car to a third party;',
          'racing, testing or driving lessons;',
          'towing another vehicle or a trailer without our consent;',
          'off-road driving or overloading the car;',
          'smoking in the car;',
          'using the car for any unlawful purpose.',
        ],
        'Pets are allowed only by prior arrangement.',
        'If a warning light comes on or you notice a fault, stop when it is safe and call us. We do not reimburse repairs we have not approved.',
      ],
    },
    {
      id: 'abroad',
      title: 'Travel outside Serbia',
      blocks: [
        'The car may leave Serbia only with our prior consent and the “Driving outside Serbia (green card)” extra, as per the price list. Tell us about a planned trip abroad when booking, or at the latest at pick-up.',
        'Leaving the country without our consent is not allowed, and the insurance does not cover any damage in that case.',
        'Abroad, please follow local regulations; tolls, vignettes and fees are paid by the renter.',
      ],
    },
    {
      id: 'insurance',
      title: 'Insurance and liability for damage',
      blocks: [
        'All cars have compulsory third-party liability insurance. The rental price also includes basic vehicle insurance with an excess payable by the renter; the excess amount is stated in the rental agreement.',
        'With the “Full insurance (zero excess)” extra, you pay nothing towards damage to the car.',
        'The insurance does not cover damage, and the renter pays for it in full, if it was caused:',
        [
          'under the influence of alcohol, drugs or medication that affects your ability to drive;',
          'intentionally or through gross negligence;',
          'while the car was driven by someone not named in the rental agreement;',
          'outside Serbia without our consent, or by using the car contrary to these terms;',
          'in a traffic accident that was neither reported to the police nor recorded in a European Accident Statement.',
        ],
        'The renter bears the actual cost of lost or damaged keys and vehicle documents.',
      ],
    },
    {
      id: 'accident',
      title: 'Accident, breakdown or theft',
      blocks: [
        `Accident: secure the scene, call the police (192) when required and contact us immediately at +381 ${f.phone.slice(1)} (available 24/7). For a minor accident with no injuries, where both drivers agree, a European Accident Statement can be filled in — please contact us right away in that case too.`,
        'Breakdown: call us at any time — roadside assistance is available 24/7. We will arrange a roadside repair or, where possible, a replacement car.',
        'Theft: report it to the police and to us immediately, and return the car keys and documents to us.',
      ],
    },
    {
      id: 'fines',
      title: 'Traffic offences and other costs',
      blocks: [
        'During the rental, the renter is responsible for traffic offences, parking fines, tolls and other costs arising from the use of the car. If an authority requests the driver’s details after the rental, we will provide the details from the rental agreement.',
        'Return the car in the condition in which you received it, allowing for normal use. If the interior is unusually dirty, we charge the actual cost of cleaning.',
        'We are not responsible for items left or carried in the car.',
      ],
    },
    {
      id: 'data',
      title: 'Personal data',
      blocks: ['How we collect and store your data, and your rights, are explained in our [Privacy policy](/en/privacy-policy).'],
    },
    {
      id: 'complaints',
      title: 'Complaints and disputes',
      blocks: [
        `If you are not satisfied with our service, send your complaint by email to ${c.email}, by post to ${c.address}, or call us at +381 ${f.phone.slice(1)}. We will reply within 8 days of receiving it.`,
        'These terms and the rental agreement are governed by the laws of the Republic of Serbia, in particular the Law of Obligations and the Consumer Protection Law.',
        'We will try to resolve any dispute amicably. A consumer may also start out-of-court consumer dispute resolution before a body on the list kept by the ministry responsible for consumer protection. If the dispute is not resolved in this way, the court in Belgrade has jurisdiction, unless the law provides otherwise for consumers.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: ['We may change these terms. Your rental is governed by the terms published at the time of your booking.'],
    },
  ],
};

export const privacy = {
  eyebrow: 'Legal information',
  title: ['Privacy ', 'policy'],
  updated: UPDATED,
  intro: [
    'This policy explains which personal data we collect when you use the website and rent a car, why we collect it, how long we keep it and what your rights are. We process data in accordance with the Serbian Law on Personal Data Protection (Official Gazette of the Republic of Serbia, No. 87/2018).',
  ],
  sections: [
    {
      id: 'controller',
      title: 'Who processes your data',
      blocks: [`The data controller is ${firm}. For any questions about personal data, email us at ${c.email} or call +381 ${f.phone.slice(1)}.`],
    },
    {
      id: 'data',
      title: 'What data we collect',
      blocks: [
        [
          'Online booking: name, email, phone number, chosen car, pick-up and return dates and times, location, extras, note and website language.',
          'Rental: details from your ID card or passport and driving licence entered in the rental agreement, the amount and method of payment, the condition of the car and, where needed, details of a traffic accident or offence.',
          'Contact by phone, WhatsApp, email or Instagram: the data you send us yourself.',
          'Technical data: when you open the website, the hosting and the services listed below automatically receive your IP address and browser details.',
        ],
        'We do not collect card details on the website — payment is made at pick-up.',
      ],
    },
    {
      id: 'purpose',
      title: 'Why we process data and on what legal basis',
      blocks: [
        [
          'To process your booking, send the confirmation and a reminder the day before pick-up, and to conclude and perform the rental agreement — performance of a contract and steps prior to entering into it (Article 12(1)(2) of the Law). We check the age requirement for the chosen car at pick-up, from your ID card or passport and driving licence.',
          'To comply with legal obligations, such as business and tax records and providing driver details to the competent authorities (point 3).',
          'Our legitimate interest (point 6): protection against fake bookings and abuse (e.g. a limited number of bookings from the same contact), website security, and establishing or defending legal claims.',
        ],
        'We do not send marketing messages, we do not profile users and we do not sell data.',
        'The website automatically checks whether the car is available and whether you meet the age requirement. If you think the check is wrong, please call us.',
      ],
    },
    {
      id: 'required',
      title: 'Do you have to provide data',
      blocks: ['The booking form data (except the note) and the data for the rental agreement are necessary for us to rent you a car. Without them, a booking and rental are not possible.'],
    },
    {
      id: 'recipients',
      title: 'Who else has access to the data',
      blocks: [
        [
          'Our staff who handle bookings, through a protected admin panel.',
          'Service providers processing data on our behalf: Supabase (booking database), Resend (sending confirmation and reminder emails) and Vercel (website hosting and anonymous visit statistics).',
          'Google: the website shows a Google map and uses Google Fonts; when they load, Google receives your IP address, and the map may set Google cookies.',
          'Meta (WhatsApp, Instagram): only if you contact us through these apps; their privacy rules also apply.',
          'Insurers, repair shops and public authorities (police, courts, tax administration): when needed because of damage or when required by law.',
        ],
      ],
    },
    {
      id: 'transfers',
      title: 'Transfers outside Serbia',
      blocks: ['Some of the service providers listed (Supabase, Resend, Vercel, Google, Meta) also process data outside the Republic of Serbia, in the European Union and the USA. Transfers are made in accordance with the Law, with the safeguards these providers ensure through their data processing agreements.'],
    },
    {
      id: 'retention',
      title: 'How long we keep data',
      blocks: [
        [
          'Data from bookings and rental agreements is kept for the duration of the rental and afterwards for the limitation periods for claims and the periods required by accounting and tax regulations.',
          'Data from bookings that were cancelled or did not take place is kept as long as needed for our records and protection against abuse; at your request we delete it sooner, unless we are legally required to keep it.',
          'Correspondence and messages are kept as long as needed to deal with your enquiry.',
        ],
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        'Under the Law, you have the right to:',
        [
          'know whether we process your data and receive a copy of it;',
          'have inaccurate data corrected or incomplete data completed;',
          'have your data erased when there is no longer a basis for processing it;',
          'restrict processing;',
          'receive your data in a structured, commonly used format (portability);',
          'object to processing based on our legitimate interest.',
        ],
        `Send your request to ${c.email} or call +381 ${f.phone.slice(1)}. We reply without delay and at the latest within 30 days; we may ask you to confirm your identity first.`,
      ],
    },
    {
      id: 'commissioner',
      title: 'Complaint to the Commissioner',
      blocks: ['If you believe we process your data in breach of the Law, you can lodge a complaint with the Commissioner for Information of Public Importance and Personal Data Protection, Bulevar kralja Aleksandra 15, 11120 Belgrade, [www.poverenik.rs](https://www.poverenik.rs).'],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      blocks: ['The website does not use cookies for analytics or advertising. For anonymous visit statistics (number of visits, pages viewed, country and device type) we use Vercel Web Analytics, which works without cookies and does not collect data that could identify a visitor. The Google map in the footer and Google Fonts are loaded from Google servers, which may use their own cookies and technical data under [Google’s privacy policy](https://policies.google.com/privacy). The admin panel uses browser storage only for staff sign-in.'],
    },
    {
      id: 'security',
      title: 'Data security',
      blocks: ['The website uses an encrypted connection (HTTPS). Bookings can be accessed only by authorised staff with a personal sign-in, and the database is protected by rules that do not allow data to be read from the public website.'],
    },
    {
      id: 'minors',
      title: 'Minors',
      blocks: ['Only adults can rent a car, so we do not knowingly collect data about minors.'],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: ['We may change this policy; the current version is always published on this page with the date of the last update.'],
    },
  ],
};
