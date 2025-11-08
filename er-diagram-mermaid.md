# Crescent Change API MongoDB ER Diagram (Mermaid)

```mermaid
erDiagram
    %% Authentication System
    Auth {
        ObjectId _id PK
        string email UK
        string password
        enum role
        boolean isActive
        boolean isDeleted
        string otp
        Date otpExpiry
        boolean isVerifiedByOTP
        boolean isProfile
        Date passwordChangedAt
        string deactivationReason
        Date deactivatedAt
        Date createdAt
        Date updatedAt
    }

    %% User Profiles
    Client {
        ObjectId _id PK
        ObjectId auth FK,UK
        string name
        string address
        string state
        string postalCode
        string image
        string nameInCard
        string cardNumber
        Date cardExpiryDate
        string cardCVC
        Date createdAt
        Date updatedAt
    }

    Business {
        ObjectId _id PK
        ObjectId auth FK,UK
        string category
        string name
        string tagLine
        string description
        string coverImage
        string businessPhoneNumber
        string businessEmail
        string businessWebsite
        array locations
        Date createdAt
        Date updatedAt
    }

    Organization {
        ObjectId _id PK
        ObjectId auth FK,UK
        string name
        string serviceType
        string address
        string state
        string postalCode
        string website
        string phoneNumber
        string coverImage
        string tfnOrAbnNumber
        string zakatLicenseHolderNumber
        string stripeConnectAccountId
        string boardMemberName
        string boardMemberEmail
        string boardMemberPhoneNumber
        string drivingLicenseURL
        string nameInCard
        string cardNumber
        Date cardExpiryDate
        string cardCVC
        Date createdAt
        Date updatedAt
    }

    %% Donation System
    Donation {
        ObjectId _id PK
        ObjectId donor FK
        ObjectId organization FK
        ObjectId cause FK
        enum donationType
        number amount
        string currency
        string stripePaymentIntentId UK
        string stripeChargeId UK
        string stripeConnectAccountId
        enum status
        Date donationDate
        string specialMessage
        ObjectId scheduledDonationId
        ObjectId roundUpId FK
        array roundUpTransactionIds
        boolean receiptGenerated
        ObjectId receiptId
        number pointsEarned
        number refundAmount
        Date refundDate
        string refundReason
        Date createdAt
        Date updatedAt
    }

    Cause {
        ObjectId _id PK
        enum name
        string notes
        ObjectId organization FK
        Date createdAt
        Date updatedAt
    }

    %% Round-up System
    BankConnection {
        ObjectId _id PK
        ObjectId user FK
        string plaidItemId UK
        string plaidAccessToken
        string institutionId
        string institutionName
        string accountId
        string accountName
        enum accountType
        string accountSubtype
        string accountNumber
        enum consentStatus
        Date consentExpiryDate
        string webhookUrl
        Date lastSuccessfulUpdate
        string errorCode
        string errorMessage
        Date connectedDate
        Date lastSyncedDate
        boolean isActive
        Date createdAt
        Date updatedAt
    }

    RoundUpTransaction {
        ObjectId _id PK
        ObjectId roundUp FK
        ObjectId user FK
        ObjectId bankConnection FK
        string plaidTransactionId UK
        string plaidAccountId
        number originalAmount
        number roundUpValue
        Date transactionDate
        string transactionDescription
        enum transactionType
        array category
        string merchantName
        object location
        boolean processed
        ObjectId donationId
        Date createdAt
        Date updatedAt
    }

    RoundUp {
        ObjectId _id PK
        ObjectId userId FK,UK
        ObjectId bankConnection FK,UK
        number monthlyLimit
        ObjectId charity FK
        boolean isActive
        Date createdAt
        Date updatedAt
    }

    %% Notification System
    Notification {
        ObjectId _id PK
        string title
        string message
        boolean isSeen
        ObjectId receiver FK
        enum type
        string redirectId
        Date createdAt
        Date updatedAt
    }

    %% Relationships
    Auth ||--|| Client : "has profile"
    Auth ||--|| Business : "has profile"
    Auth ||--|| Organization : "has profile"
    Auth ||--o{ Notification : "receives"

    Client ||--o{ Donation : "makes"
    Client ||--o{ BankConnection : "connects"
    Client ||--o{ RoundUpTransaction : "generates"
    Client ||--|| RoundUp : "participates in"

    Organization ||--o{ Donation : "receives"
    Organization ||--o{ Cause : "creates"
    Organization ||--o{ RoundUp : "receives from"

    Cause ||--o| Donation : "categorizes"

    BankConnection ||--o{ RoundUpTransaction : "tracks"
    BankConnection ||--|| RoundUp : "configured for"

    RoundUp ||--o{ RoundUpTransaction : "generates donations from"
    RoundUp ||--o| Donation : "creates"

    RoundUpTransaction ||--o| Donation : "processed as"
