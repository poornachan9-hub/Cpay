import { ethers } from "ethers";
import { CONTRACT_ABI, SUPPLY_CHAIN_ADDRESS } from "../lib/supplyChainABI";

const POLYGON_RPC_FALLBACK = "https://polygon.drpc.org";
const POLYGON_CHAIN_ID = 137;

export const SHIPMENT_STATUS = {
  0: "PENDING",
  1: "IN_TRANSIT",
  2: "DELIVERED",
  3: "CANCELLED",
};

export const SHIPMENT_CATEGORIES = [
  "ELECTRONICS",
  "CLOTHING",
  "BOOKS",
  "FOOD",
  "MEDICAL",
  "OTHER",
];

export const SHIPMENT_TYPES = ["STANDARD", "EXPRESS", "OVERNIGHT", "FRAGILE"];

export class SupplyChainService {
  constructor() {
    this.contractAddress = SUPPLY_CHAIN_ADDRESS;
  }

  getReadOnlyProvider() {
    return new ethers.providers.JsonRpcProvider(POLYGON_RPC_FALLBACK, POLYGON_CHAIN_ID);
  }

  getContract(signerOrProvider) {
    const p = signerOrProvider || this.getReadOnlyProvider();
    return new ethers.Contract(this.contractAddress, CONTRACT_ABI, p);
  }

  getSigner() {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No Web3 wallet detected. Please connect MetaMask.");
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    return provider.getSigner();
  }

  formatShipment(raw, id) {
    if (!raw) return null;
    const details = raw.details || {};
    const statusNum = raw.status !== undefined ? Number(raw.status) : 0;
    const catNum = details.category !== undefined ? Number(details.category) : 5;
    const typeNum = details.shipmentType !== undefined ? Number(details.shipmentType) : 0;

    return {
      id: id !== undefined ? id.toString() : raw.id?.toString(),
      sender: raw.sender,
      receiver: raw.receiver,
      carrier: raw.carrier,
      status: SHIPMENT_STATUS[statusNum] || "UNKNOWN",
      statusCode: statusNum,
      pickupTime: raw.pickupTime ? new Date(raw.pickupTime.toNumber() * 1000) : null,
      estimatedDelivery: raw.estimatedDelivery
        ? new Date(raw.estimatedDelivery.toNumber() * 1000)
        : null,
      createdAt: raw.createdAt ? new Date(raw.createdAt.toNumber() * 1000) : null,
      lastUpdated: raw.lastUpdated ? new Date(raw.lastUpdated.toNumber() * 1000) : null,
      declaredValue: raw.price ? ethers.utils.formatEther(raw.price) : "0",
      declaredValueWei: raw.price,
      isInsured: raw.isInsured,
      title: details.title || `Shipment #${id}`,
      description: details.description || "",
      senderName: details.senderName || "",
      receiverName: details.receiverName || "",
      category: SHIPMENT_CATEGORIES[catNum] || "OTHER",
      shipmentType: SHIPMENT_TYPES[typeNum] || "STANDARD",
      weight: details.weight ? ethers.utils.formatEther(details.weight) : "0",
      dimensions: details.dimensions || "",
      imageHashes: details.imageHashes || [],
      documentHash: details.documentHash || "",
      requiresSignature: details.requiresSignature || false,
    };
  }

  async getShipment(shipmentId) {
    try {
      const contract = this.getContract();
      const raw = await contract.getShipment(shipmentId);
      const formatted = this.formatShipment(raw, shipmentId);

      // Also retrieve tracking history
      try {
        const historyRaw = await contract.getTrackingHistory(shipmentId);
        formatted.trackingHistory = (historyRaw || []).map((t) => ({
          timestamp: new Date(t.timestamp.toNumber() * 1000),
          location: t.location || "",
          notes: t.notes || "",
          imageHash: t.imageHash || "",
          status: SHIPMENT_STATUS[Number(t.status)] || "UNKNOWN",
          statusCode: Number(t.status),
          updater: t.updater,
        }));
      } catch (_) {
        formatted.trackingHistory = [];
      }

      return formatted;
    } catch (err) {
      console.error(`Error fetching shipment #${shipmentId}:`, err);
      return null;
    }
  }

  async getUserShipments(address) {
    if (!address || !ethers.utils.isAddress(address)) return [];
    try {
      const contract = this.getContract();
      const [senderIds, receiverIds, carrierIds] = await Promise.all([
        contract.getUserShipments(address, "sender").catch(() => []),
        contract.getUserShipments(address, "receiver").catch(() => []),
        contract.getUserShipments(address, "carrier").catch(() => []),
      ]);

      const allIds = [
        ...senderIds.map((id) => id.toString()),
        ...receiverIds.map((id) => id.toString()),
        ...carrierIds.map((id) => id.toString()),
      ];
      const uniqueIds = [...new Set(allIds)].reverse(); // newest first

      const shipments = await Promise.all(
        uniqueIds.slice(0, 30).map((id) => this.getShipment(id))
      );

      return shipments.filter(Boolean);
    } catch (err) {
      console.error("Error fetching user shipments:", err);
      return [];
    }
  }

  async createShipment(shipmentData) {
    const signer = this.getSigner();
    const contract = this.getContract(signer);

    const declaredValueEther = shipmentData.declaredValue
      ? shipmentData.declaredValue.toString()
      : "0";
    const declaredValueWei = ethers.utils.parseEther(declaredValueEther);

    const weightWei = shipmentData.weight
      ? ethers.utils.parseEther(shipmentData.weight.toString())
      : ethers.constants.Zero;

    const details = [
      shipmentData.title || "Shipment",
      shipmentData.description || "",
      shipmentData.senderName || "",
      shipmentData.receiverName || "",
      Number(shipmentData.category || 0),
      Number(shipmentData.shipmentType || 0),
      weightWei,
      shipmentData.dimensions || "",
      shipmentData.imageHashes || [],
      shipmentData.documentHash || "",
      Boolean(shipmentData.requiresSignature),
      declaredValueWei,
    ];

    const pickupTimestamp = Math.floor(new Date(shipmentData.pickupTime).getTime() / 1000);
    const deliveryTimestamp = Math.floor(new Date(shipmentData.estimatedDelivery).getTime() / 1000);

    const tx = await contract.createShipment(
      shipmentData.receiver,
      shipmentData.carrier,
      pickupTimestamp,
      deliveryTimestamp,
      Boolean(shipmentData.requireInsurance),
      details,
      {
        value: declaredValueWei,
      }
    );

    const receipt = await tx.wait();
    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    };
  }

  async startShipment(shipmentId, location, notes, imageHash = "") {
    const signer = this.getSigner();
    const contract = this.getContract(signer);

    const tx = await contract.startShipment(
      shipmentId,
      location || "Dispatched",
      notes || "Carrier picked up shipment",
      imageHash || ""
    );

    const receipt = await tx.wait();
    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async completeShipment(shipmentId, location, notes, imageHash = "") {
    const signer = this.getSigner();
    const contract = this.getContract(signer);

    const tx = await contract.completeShipment(
      shipmentId,
      location || "Delivered",
      notes || "Shipment successfully delivered",
      imageHash || ""
    );

    const receipt = await tx.wait();
    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async cancelShipment(shipmentId, reason) {
    const signer = this.getSigner();
    const contract = this.getContract(signer);

    const tx = await contract.cancelShipment(shipmentId, reason || "Cancelled by user");
    const receipt = await tx.wait();
    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }
}

export const supplyChainService = new SupplyChainService();
