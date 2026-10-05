import { PINATA_CONFIG } from "../lib/constants";

class PinataService {
  constructor() {
    this.baseURL = "https://api.pinata.cloud";
  }

  get headers() {
    return {
      Authorization: `Bearer ${PINATA_CONFIG.JWT}`,
    };
  }

  async uploadFile(file, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      if (metadata.name) {
        formData.append(
          "pinataMetadata",
          JSON.stringify({
            name: metadata.name,
            keyvalues: metadata.keyvalues || {},
          })
        );
      }

      if (metadata.options) {
        formData.append("pinataOptions", JSON.stringify(metadata.options));
      }

      const response = await fetch(`${this.baseURL}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers: this.headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Pinata Error Details:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        ipfsHash: result.IpfsHash,
        pinSize: result.PinSize,
        timestamp: result.Timestamp,
      };
    } catch (error) {
      console.error("Error uploading file to Pinata:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async uploadJSON(jsonData, metadata = {}) {
    try {
      const data = {
        pinataContent: jsonData,
        pinataMetadata: {
          name: metadata.name || "JSON Upload",
          keyvalues: metadata.keyvalues || {},
        },
        pinataOptions: metadata.options || {
          cidVersion: 1,
        },
      };

      const response = await fetch(`${this.baseURL}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Pinata Error Details:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        ipfsHash: result.IpfsHash,
        pinSize: result.PinSize,
        timestamp: result.Timestamp,
      };
    } catch (error) {
      console.error("Error uploading JSON to Pinata:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async unpinFile(ipfsHash) {
    try {
      const response = await fetch(
        `${this.baseURL}/pinning/unpin/${ipfsHash}`,
        {
          method: "DELETE",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        message: "File unpinned successfully",
      };
    } catch (error) {
      console.error("Error unpinning file:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPinnedFiles() {
    try {
      const response = await fetch(
        `${this.baseURL}/data/pinList?status=pinned`,
        {
          method: "GET",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        files: result.rows,
        count: result.count,
      };
    } catch (error) {
      console.error("Error getting pinned files:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getIPFSUrl(hash) {
    const url = `${PINATA_CONFIG.GATEWAY}${hash}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      // Extract and return only the image URL

      console.log(data.image);
      return data.image;
    } catch (error) {
      console.error("Error fetching IPFS data:", error);
      return null;
    }
  }

  async fetchFromIPFS(hash) {
    try {
      const gatewayUrl = PINATA_CONFIG.GATEWAY || "https://gateway.pinata.cloud/ipfs/";
      const baseUrl = gatewayUrl.endsWith("/") ? gatewayUrl : gatewayUrl + "/";
      const fetchHash = hash.replace("ipfs://", "");
      const url = `${baseUrl}${fetchHash}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      } else {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          return text;
        }
      }
    } catch (error) {
      console.error("Error fetching from IPFS:", error);
      throw error;
    }
  }
}

export const pinataService = new PinataService();
