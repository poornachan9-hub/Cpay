// Add your contract ABI here
export const CONTRACT_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "approver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "KYCApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "reason",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "KYCRejected",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Paused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "previousAdminRole",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "newAdminRole",
        type: "bytes32",
      },
    ],
    name: "RoleAdminChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "shipmentId",
        type: "uint256",
      },
    ],
    name: "ShipmentCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "shipmentId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "carrier",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isInsured",
        type: "bool",
      },
    ],
    name: "ShipmentCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "shipmentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "deliveryTime",
        type: "uint256",
      },
    ],
    name: "ShipmentDelivered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "shipmentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum SupplyChain.ShipmentStatus",
        name: "oldStatus",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "enum SupplyChain.ShipmentStatus",
        name: "newStatus",
        type: "uint8",
      },
    ],
    name: "ShipmentStatusChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "shipmentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "location",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "status",
        type: "string",
      },
    ],
    name: "TrackingUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Unpaused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "UserRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "reason",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "UserSuspended",
    type: "event",
  },
  {
    inputs: [],
    name: "ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "KYC_VALIDITY_PERIOD",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "activeShipmentIndex",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "activeShipments",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "approveKYC",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_reason",
        type: "string",
      },
    ],
    name: "cancelShipment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "carrierShipments",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_deliveryLocation",
        type: "string",
      },
      {
        internalType: "string",
        name: "_notes",
        type: "string",
      },
      {
        internalType: "string",
        name: "_proofImageHash",
        type: "string",
      },
    ],
    name: "completeShipment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "_carrier",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_pickupTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_estimatedDelivery",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_requireInsurance",
        type: "bool",
      },
      {
        components: [
          {
            internalType: "string",
            name: "title",
            type: "string",
          },
          {
            internalType: "string",
            name: "description",
            type: "string",
          },
          {
            internalType: "string",
            name: "senderName",
            type: "string",
          },
          {
            internalType: "string",
            name: "receiverName",
            type: "string",
          },
          {
            internalType: "enum SupplyChain.ShipmentCategory",
            name: "category",
            type: "uint8",
          },
          {
            internalType: "enum SupplyChain.ShipmentType",
            name: "shipmentType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "weight",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "dimensions",
            type: "string",
          },
          {
            internalType: "string[]",
            name: "imageHashes",
            type: "string[]",
          },
          {
            internalType: "string",
            name: "documentHash",
            type: "string",
          },
          {
            internalType: "bool",
            name: "requiresSignature",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "declaredValue",
            type: "uint256",
          },
        ],
        internalType: "struct SupplyChain.ShipmentDetails",
        name: "_details",
        type: "tuple",
      },
    ],
    name: "createShipment",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "emergencyPause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "emergencyUnpause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "emergencyWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getActiveShipments",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPendingKYCUsers",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleAdmin",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
    ],
    name: "getShipment",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "sender",
            type: "address",
          },
          {
            internalType: "address",
            name: "receiver",
            type: "address",
          },
          {
            internalType: "address",
            name: "carrier",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "pickupTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deliveryTime",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "enum SupplyChain.ShipmentStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "isPaid",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "isInsured",
            type: "bool",
          },
          {
            components: [
              {
                internalType: "string",
                name: "title",
                type: "string",
              },
              {
                internalType: "string",
                name: "description",
                type: "string",
              },
              {
                internalType: "string",
                name: "senderName",
                type: "string",
              },
              {
                internalType: "string",
                name: "receiverName",
                type: "string",
              },
              {
                internalType: "enum SupplyChain.ShipmentCategory",
                name: "category",
                type: "uint8",
              },
              {
                internalType: "enum SupplyChain.ShipmentType",
                name: "shipmentType",
                type: "uint8",
              },
              {
                internalType: "uint256",
                name: "weight",
                type: "uint256",
              },
              {
                internalType: "string",
                name: "dimensions",
                type: "string",
              },
              {
                internalType: "string[]",
                name: "imageHashes",
                type: "string[]",
              },
              {
                internalType: "string",
                name: "documentHash",
                type: "string",
              },
              {
                internalType: "bool",
                name: "requiresSignature",
                type: "bool",
              },
              {
                internalType: "uint256",
                name: "declaredValue",
                type: "uint256",
              },
            ],
            internalType: "struct SupplyChain.ShipmentDetails",
            name: "details",
            type: "tuple",
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "estimatedDelivery",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "lastUpdated",
            type: "uint256",
          },
        ],
        internalType: "struct SupplyChain.Shipment",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
    ],
    name: "getTrackingHistory",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "location",
            type: "string",
          },
          {
            internalType: "string",
            name: "status",
            type: "string",
          },
          {
            internalType: "string",
            name: "notes",
            type: "string",
          },
          {
            internalType: "string",
            name: "imageHash",
            type: "string",
          },
          {
            internalType: "address",
            name: "updatedBy",
            type: "address",
          },
        ],
        internalType: "struct SupplyChain.TrackingInfo[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "getUserKYC",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "fullName",
            type: "string",
          },
          {
            internalType: "string",
            name: "email",
            type: "string",
          },
          {
            internalType: "string",
            name: "phoneNumber",
            type: "string",
          },
          {
            internalType: "string",
            name: "nationalId",
            type: "string",
          },
          {
            internalType: "string",
            name: "homeAddress",
            type: "string",
          },
          {
            internalType: "string",
            name: "idDocumentHash",
            type: "string",
          },
          {
            internalType: "string",
            name: "addressProofHash",
            type: "string",
          },
          {
            internalType: "string",
            name: "profileImageHash",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "submittedAt",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "verifiedAt",
            type: "uint256",
          },
          {
            internalType: "enum SupplyChain.UserStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "string",
            name: "rejectionReason",
            type: "string",
          },
        ],
        internalType: "struct SupplyChain.KYCDetails",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "string",
        name: "_type",
        type: "string",
      },
    ],
    name: "getUserShipments",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "hasRole",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "inPendingKYC",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "isActiveShipment",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isRegistered",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
    ],
    name: "isUserVerified",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "pendingKYCIndex",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "pendingKYCUsers",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "receiverShipments",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_fullName",
        type: "string",
      },
      {
        internalType: "string",
        name: "_email",
        type: "string",
      },
      {
        internalType: "string",
        name: "_phoneNumber",
        type: "string",
      },
      {
        internalType: "string",
        name: "_nationalId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_homeAddress",
        type: "string",
      },
      {
        internalType: "string",
        name: "_idDocumentHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "_addressProofHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "_profileImageHash",
        type: "string",
      },
    ],
    name: "registerUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "string",
        name: "_reason",
        type: "string",
      },
    ],
    name: "rejectKYC",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "renounceRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "senderShipments",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "shipments",
    outputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "carrier",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "pickupTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deliveryTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "enum SupplyChain.ShipmentStatus",
        name: "status",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "isPaid",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isInsured",
        type: "bool",
      },
      {
        components: [
          {
            internalType: "string",
            name: "title",
            type: "string",
          },
          {
            internalType: "string",
            name: "description",
            type: "string",
          },
          {
            internalType: "string",
            name: "senderName",
            type: "string",
          },
          {
            internalType: "string",
            name: "receiverName",
            type: "string",
          },
          {
            internalType: "enum SupplyChain.ShipmentCategory",
            name: "category",
            type: "uint8",
          },
          {
            internalType: "enum SupplyChain.ShipmentType",
            name: "shipmentType",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "weight",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "dimensions",
            type: "string",
          },
          {
            internalType: "string[]",
            name: "imageHashes",
            type: "string[]",
          },
          {
            internalType: "string",
            name: "documentHash",
            type: "string",
          },
          {
            internalType: "bool",
            name: "requiresSignature",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "declaredValue",
            type: "uint256",
          },
        ],
        internalType: "struct SupplyChain.ShipmentDetails",
        name: "details",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "createdAt",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "estimatedDelivery",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lastUpdated",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_location",
        type: "string",
      },
      {
        internalType: "string",
        name: "_notes",
        type: "string",
      },
      {
        internalType: "string",
        name: "_imageHash",
        type: "string",
      },
    ],
    name: "startShipment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "string",
        name: "_reason",
        type: "string",
      },
    ],
    name: "suspendUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "trackingHistory",
    outputs: [
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "location",
        type: "string",
      },
      {
        internalType: "string",
        name: "status",
        type: "string",
      },
      {
        internalType: "string",
        name: "notes",
        type: "string",
      },
      {
        internalType: "string",
        name: "imageHash",
        type: "string",
      },
      {
        internalType: "address",
        name: "updatedBy",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_shipmentId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_location",
        type: "string",
      },
      {
        internalType: "string",
        name: "_status",
        type: "string",
      },
      {
        internalType: "string",
        name: "_notes",
        type: "string",
      },
      {
        internalType: "string",
        name: "_imageHash",
        type: "string",
      },
    ],
    name: "updateTracking",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "userKYC",
    outputs: [
      {
        internalType: "string",
        name: "fullName",
        type: "string",
      },
      {
        internalType: "string",
        name: "email",
        type: "string",
      },
      {
        internalType: "string",
        name: "phoneNumber",
        type: "string",
      },
      {
        internalType: "string",
        name: "nationalId",
        type: "string",
      },
      {
        internalType: "string",
        name: "homeAddress",
        type: "string",
      },
      {
        internalType: "string",
        name: "idDocumentHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "addressProofHash",
        type: "string",
      },
      {
        internalType: "string",
        name: "profileImageHash",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "submittedAt",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "verifiedAt",
        type: "uint256",
      },
      {
        internalType: "enum SupplyChain.UserStatus",
        name: "status",
        type: "uint8",
      },
      {
        internalType: "string",
        name: "rejectionReason",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
  // ── Escrow: new events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "shipmentId",  type: "uint256" },
      { indexed: true,  internalType: "address", name: "confirmedBy", type: "address" },
      { indexed: false, internalType: "string",  name: "role",        type: "string"  },
    ],
    name: "EscrowConfirmed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "shipmentId",  type: "uint256" },
      { indexed: true,  internalType: "address", name: "carrier",     type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",      type: "uint256" },
      { indexed: false, internalType: "address", name: "releasedBy",  type: "address" },
    ],
    name: "EscrowReleased",
    type: "event",
  },
  // ── Escrow: write functions ──
  {
    inputs: [{ internalType: "uint256", name: "_shipmentId", type: "uint256" }],
    name: "adminReleasePayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_shipmentId", type: "uint256" }],
    name: "confirmEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Escrow: read mappings ──
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "escrowCarrierConfirmed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "escrowReceiverConfirmed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];


export const SUPPLY_CHAIN_ADDRESS = process.env.NEXT_PUBLIC_SUPPLY_CHAIN_ADDRESS || '0x8B76DE2727Cad915c9aa9824F688F9460d1a57c8';
export const CONTRACT_ADDRESS = SUPPLY_CHAIN_ADDRESS;
