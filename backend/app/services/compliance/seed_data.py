"""
seed_data.py
Hardcoded regulatory text from RBI KYC Master Directions (2016, updated 2024)
and Punjab & Sind Bank KYC/AML policy.
Used as fallback when live scraping is unavailable.
"""

SEED_DOCUMENTS = [
    {
        "source_name": "RBI_KYC_Master_Direction_2016",
        "url": "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11566",
        "type": "seed",
        "text": """
RBI Master Direction - Know Your Customer (KYC) Direction, 2016
(Updated as on May 10, 2021)

Section 1 - Short Title and Commencement
These Directions shall be called the Reserve Bank of India (Know Your Customer (KYC)) Directions, 2016.

Section 2 - Applicability
These Directions are applicable to all Regulated Entities (REs) including commercial banks, cooperative banks, regional rural banks, local area banks, payments banks, small finance banks, non-banking financial companies, and other financial institutions regulated by RBI.

Section 3 - Definitions
3.1 Customer Due Diligence (CDD): The process of identifying and verifying the identity of customers and beneficial owners, understanding the nature and purpose of the business relationship, and conducting ongoing monitoring.
3.2 Know Your Customer (KYC): The process of identifying and verifying the identity of customers at the time of commencement of an account-based relationship.
3.3 Beneficial Owner: A natural person who ultimately owns or controls a customer or on whose behalf a transaction is being conducted.
3.4 Politically Exposed Person (PEP): Individuals who are or have been entrusted with prominent public functions in a foreign country.
3.5 High Risk Customer: Customers assessed as posing higher risk of money laundering or terrorist financing.
3.6 Suspicious Transaction: A transaction that gives rise to a reasonable ground of suspicion that it may involve proceeds of an offence.

Section 10 - Customer Acceptance Policy
10.1 Every RE shall formulate a Customer Acceptance Policy (CAP) laying down explicit criteria for acceptance of customers.
10.2 No account shall be opened in anonymous or fictitious/benami name(s).
10.3 The RE shall not open an account or carry out any transaction where it is unable to apply CDD measures.

Section 16 - Customer Due Diligence (CDD) Procedure
16.1 REs shall undertake CDD measures while:
(a) Commencing an account-based relationship;
(b) Carrying out transactions of ₹50,000 and above (whether conducted as a single transaction or several transactions that appear to be connected);
(c) Carrying out wire transfer of ₹50,000 and above;
(d) When there is a doubt about the authenticity or adequacy of previously obtained customer identification data.

16.2 The CDD procedure shall involve the following:
(a) Identifying the customer and verifying the customer's identity using reliable, independent source documents, data or information;
(b) Identifying the beneficial owner and taking reasonable measures to verify the identity of the beneficial owner;
(c) Understanding and, as appropriate, obtaining information on the purpose and intended nature of the business relationship;
(d) Conducting ongoing due diligence of the business relationship.

Section 17 - Officially Valid Documents (OVDs) for KYC
17.1 The following documents are Officially Valid Documents (OVDs) for KYC purposes:
(a) Passport
(b) Driving Licence
(c) Proof of possession of Aadhaar number
(d) Voter's Identity Card issued by the Election Commission of India
(e) Job card issued by NREGA duly signed by an officer of the State Government
(f) Letter issued by the National Population Register containing details of name and address

17.2 Where the customer submits Aadhaar for KYC, the RE shall carry out authentication using e-KYC facility of UIDAI.

17.3 For customers who do not have any of the OVDs, the RE may accept any one of the following documents:
(a) Identity card with applicant's photograph issued by Central/State Government Departments
(b) Scheduled Commercial Banks, Public Sector Undertakings, Statutory/Regulatory Authorities
(c) Scheduled Caste and Scheduled Tribe Certificates issued by State Government

Section 18 - Simplified Measures for Low Risk Customers
18.1 Where a customer is assessed as low risk, the RE may apply simplified CDD measures.
18.2 Simplified CDD includes acceptance of self-certified copy of OVD.

Section 20 - Non-Face-to-Face Customers
20.1 For non-face-to-face customers, REs shall apply equivalent CDD measures as for face-to-face customers.
20.2 Additional measures include: first payment from an account in the customer's name with a bank subject to similar CDD standards.

Section 27 - Risk Categorisation
27.1 REs shall categorise customers into low, medium, and high risk categories based on:
(a) Nature of business activity
(b) Location of customer and his clients
(c) Mode of payments
(d) Volume of turnover
(e) Social and financial status

27.2 High Risk Customers include:
(a) Non-resident customers
(b) High net worth individuals
(c) Trusts, charities, NGOs
(d) Politically Exposed Persons (PEPs)
(e) Customers with dubious reputation
(f) Companies having close family shareholding or beneficial ownership

Section 38 - Periodic Updation of KYC
38.1 REs shall periodically update the KYC data of their customers.
38.2 The periodicity of KYC updation shall be as follows:
(a) High Risk customers: At least once in 2 (two) years
(b) Medium Risk customers: At least once in 8 (eight) years
(c) Low Risk customers: At least once in 10 (ten) years

38.3 The RE shall put in place a system of periodic review of risk categorisation of accounts.
38.4 Accounts where KYC updation is pending shall be subjected to partial freezing after due notice.

Section 39 - Freezing of Accounts
39.1 Where a customer fails to submit KYC documents within the stipulated time, the RE shall:
(a) First, send reminders to the customer
(b) After due notice, impose partial freezing (only credits allowed)
(c) After further notice, impose full freezing

Section 40 - Enhanced Due Diligence (EDD)
40.1 REs shall apply EDD measures for high risk customers including:
(a) Obtaining additional information on the customer
(b) Obtaining information on the source of funds/wealth
(c) Conducting enhanced monitoring of the business relationship

Section 51 - Suspicious Transaction Reporting (STR)
51.1 REs shall file Suspicious Transaction Reports (STRs) with the Financial Intelligence Unit - India (FIU-IND).
51.2 STRs shall be filed within 7 (seven) days of arriving at a conclusion that a transaction is suspicious.
51.3 The RE shall not tip off the customer that an STR has been filed.
51.4 STRs shall be filed irrespective of the amount involved.

Section 52 - Cash Transaction Reports (CTR)
52.1 REs shall file Cash Transaction Reports (CTRs) with FIU-IND for:
(a) All cash transactions of the value of more than ₹10 lakh or its equivalent in foreign currency.
(b) All series of cash transactions integrally connected to each other which have been valued below ₹10 lakh where such series of transactions have taken place within a month and the aggregate value of such transactions exceeds ₹10 lakh.
52.2 CTRs shall be filed within 15 days of the close of the month.

Section 53 - Non-Profit Organisation (NPO) Transactions
53.1 REs shall file reports on transactions of NPOs with FIU-IND.

Section 56 - Record Management
56.1 REs shall maintain records of all transactions including the information obtained through CDD process.
56.2 Records shall be maintained for a period of 5 (five) years from the date of cessation of the transaction or the business relationship, whichever is later.
56.3 Records shall be made available to competent authorities upon request.

Section 57 - Wire Transfer Requirements
57.1 For wire transfers of ₹50,000 and above, the originating RE shall ensure that the transfer is accompanied by accurate and meaningful originator information.
57.2 The information shall include: name, address, account number of the originator.
        """,
    },
    {
        "source_name": "PSB_KYC_AML_Policy",
        "url": "https://www.psbindia.com/kyc-aml-policy",
        "type": "seed",
        "text": """
Punjab & Sind Bank — KYC/AML Policy (2024)

1. Introduction
Punjab & Sind Bank (PSB) is committed to full compliance with the Prevention of Money Laundering Act (PMLA) 2002, RBI KYC Master Directions 2016, and all applicable regulatory guidelines. This policy establishes the framework for Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures.

2. Objectives
2.1 To prevent the bank from being used for money laundering or terrorist financing.
2.2 To ensure proper identification and verification of customers.
2.3 To monitor transactions and report suspicious activities.
2.4 To maintain adequate records as required by law.

3. Customer Identification and Verification
3.1 PSB shall verify the identity of all customers before opening any account or establishing a business relationship.
3.2 No account shall be opened in anonymous, fictitious, or benami names.
3.3 Acceptable KYC documents include:
    - Aadhaar Card (with e-KYC authentication via UIDAI)
    - Passport
    - Voter ID Card
    - Driving Licence
    - PAN Card (mandatory for transactions above ₹50,000)
    - NREGA Job Card
    - Letter from National Population Register

3.4 For current accounts and business accounts, additional documents required:
    - Certificate of Incorporation (for companies)
    - Partnership deed (for partnerships)
    - Trust deed (for trusts)
    - Board resolution authorizing account opening

4. Risk Categorisation
4.1 PSB categorises customers into three risk categories:
    - Low Risk: Salaried employees, pensioners, government employees with regular income
    - Medium Risk: Self-employed individuals, small business owners
    - High Risk: Non-residents, PEPs, high net worth individuals, cash-intensive businesses

4.2 Risk categorisation is reviewed periodically and updated based on transaction patterns.

5. Periodic KYC Updation
5.1 PSB follows RBI-mandated KYC updation schedule:
    - High Risk customers: Every 2 years
    - Medium Risk customers: Every 8 years
    - Low Risk customers: Every 10 years

5.2 Customers are notified 3 months before KYC expiry.
5.3 Accounts with expired KYC are subject to restrictions as per RBI guidelines.

6. Enhanced Due Diligence (EDD)
6.1 EDD is mandatory for:
    - Politically Exposed Persons (PEPs) and their family members
    - Non-resident customers
    - Customers from high-risk jurisdictions (FATF blacklist/greylist countries)
    - Customers with complex ownership structures

6.2 EDD measures include:
    - Senior management approval for account opening
    - Source of funds/wealth documentation
    - Enhanced transaction monitoring

7. Transaction Monitoring
7.1 PSB maintains an automated transaction monitoring system to detect unusual patterns.
7.2 Alerts are generated for:
    - Cash transactions above ₹10 lakh
    - Multiple transactions just below reporting thresholds (structuring)
    - Transactions inconsistent with customer profile
    - Rapid movement of funds

8. Reporting Requirements
8.1 Cash Transaction Reports (CTR): Filed with FIU-IND for cash transactions above ₹10 lakh within 15 days of month-end.
8.2 Suspicious Transaction Reports (STR): Filed with FIU-IND within 7 days of identifying a suspicious transaction.
8.3 Non-Profit Organisation (NPO) Reports: Filed for transactions involving NPOs.
8.4 Counterfeit Currency Reports (CCR): Filed when counterfeit currency is detected.

9. Record Keeping
9.1 All KYC documents and transaction records shall be maintained for a minimum of 5 years from the date of account closure or cessation of business relationship.
9.2 Records shall be stored securely and made available to regulatory authorities on demand.
9.3 Digital records shall be maintained with appropriate access controls and audit trails.

10. Staff Training
10.1 All staff dealing with customers shall undergo mandatory AML/KYC training annually.
10.2 Training covers: identification of suspicious transactions, reporting procedures, regulatory requirements.

11. Penalties for Non-Compliance
11.1 Non-compliance with KYC/AML requirements may result in:
    - Regulatory penalties from RBI
    - Criminal prosecution under PMLA 2002
    - Reputational damage to the bank
    - Suspension of banking licence in extreme cases

12. Designated Director and Principal Officer
12.1 PSB has designated a Director responsible for overall AML compliance.
12.2 A Principal Officer (Chief Compliance Officer) is responsible for filing reports with FIU-IND and liaising with regulatory authorities.
        """,
    },
    {
        "source_name": "PMLA_2002_Key_Provisions",
        "url": "https://www.indiacode.nic.in/handle/123456789/2036",
        "type": "seed",
        "text": """
Prevention of Money Laundering Act (PMLA), 2002 — Key Provisions for Banking

Section 3 - Offence of Money Laundering
Whosoever directly or indirectly attempts to indulge or knowingly assists or knowingly is a party or is actually involved in any process or activity connected with the proceeds of crime and projecting it as untainted property shall be guilty of offence of money laundering.

Section 12 - Obligations of Banking Companies
12.1 Every banking company, financial institution and intermediary shall:
(a) Maintain a record of all transactions, the nature and value of which may be prescribed, whether such transactions comprise of a single transaction or a series of transactions integrally connected to each other, and where such series of transactions take place within a month;
(b) Furnish information of transactions to the Director within such time as may be prescribed;
(c) Verify and maintain the records of the identity of all its clients, in such a manner as may be prescribed.

Section 12A - Retention of Records
12A.1 Every banking company, financial institution and intermediary shall maintain the records referred to in Section 12 for a period of five years from the date of transactions between the client and the banking company, financial institution or intermediary, as the case may be.

Section 13 - Powers of Director
The Director may call for records from any banking company, financial institution or intermediary and may make such inquiry as he deems fit.

Section 16 - Survey
Officers not below the rank of Assistant Director may enter any place within the limits of the area assigned to him and conduct survey for the purposes of this Act.

Key Thresholds under PMLA Rules:
- Cash transactions above ₹10,00,000 (₹10 lakh) must be reported
- Series of connected transactions within a month exceeding ₹10 lakh must be reported
- All suspicious transactions must be reported regardless of amount
- Wire transfers above ₹50,000 require full originator information
- Records must be retained for 5 years minimum

FATF Recommendations Compliance:
India is a member of the Financial Action Task Force (FATF). Banks must comply with FATF recommendations on:
- Customer Due Diligence
- Politically Exposed Persons
- Correspondent Banking
- Wire Transfers
- New Technologies
        """,
    },
    {
        "source_name": "RBI_AML_Master_Circular",
        "url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12153",
        "type": "seed",
        "text": """
RBI Master Circular on Anti-Money Laundering (AML) / Combating Financing of Terrorism (CFT)

1. Introduction
Banks are required to follow a comprehensive AML/CFT framework in line with PMLA 2002, FATF recommendations, and RBI guidelines.

2. Customer Due Diligence (CDD) Standards
2.1 Banks must identify and verify customers using reliable, independent source documents.
2.2 CDD must be completed BEFORE establishing a business relationship or conducting transactions.
2.3 Banks cannot open accounts or conduct transactions if CDD cannot be completed.

3. Beneficial Ownership
3.1 For legal entities, banks must identify beneficial owners holding 25% or more ownership.
3.2 For trusts, the settlor, trustees, and beneficiaries must be identified.
3.3 Beneficial ownership information must be verified and updated periodically.

4. Correspondent Banking
4.1 Banks must apply enhanced due diligence for correspondent banking relationships.
4.2 Shell banks (banks with no physical presence) must not be used as correspondents.
4.3 Banks must satisfy themselves that respondent banks have adequate AML/CFT controls.

5. Wire Transfer Monitoring
5.1 All wire transfers of ₹50,000 and above must include complete originator information.
5.2 Beneficiary banks must have procedures to identify wire transfers lacking required information.
5.3 Intermediary banks must maintain all originator and beneficiary information.

6. Politically Exposed Persons (PEPs)
6.1 Banks must have risk management systems to determine if a customer is a PEP.
6.2 Senior management approval is required before establishing relationships with PEPs.
6.3 Source of wealth and funds must be established for PEPs.
6.4 Enhanced ongoing monitoring must be applied to PEP accounts.
6.5 Domestic PEPs must be treated as high-risk customers.

7. High Risk Countries
7.1 Banks must apply enhanced due diligence for customers from FATF blacklisted countries.
7.2 Transactions with countries on FATF greylist require additional scrutiny.
7.3 Banks must refer to FATF public statements for updated country risk assessments.

8. Trade-Based Money Laundering (TBML)
8.1 Banks must be vigilant about over/under-invoicing in trade transactions.
8.2 Multiple invoicing and falsely described goods/services are red flags.
8.3 Banks must verify trade documents against market prices where possible.

9. Internal Controls
9.1 Banks must have an independent audit function to test AML/CFT systems.
9.2 A compliance function must be established with a designated compliance officer.
9.3 Employee screening must be conducted before hiring for sensitive positions.
9.4 Ongoing training programs must be maintained for all relevant staff.

10. Penalties
10.1 Non-compliance with AML/CFT requirements can result in:
    - Monetary penalties up to ₹1 crore per violation
    - Cancellation of banking licence
    - Criminal prosecution of responsible officers
    - Attachment and confiscation of proceeds of crime
        """,
    },
]
