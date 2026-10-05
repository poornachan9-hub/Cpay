import axios from "axios";

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

const pinataApiUrl = "https://api.pinata.cloud";
const pinataGateway = "https://gateway.pinata.cloud/ipfs/";

// Upload file to IPFS
export const uploadFileToIPFS = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: "file",
      },
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
      cidVersion: 0,
    });
    formData.append("pinataOptions", options);

    const response = await axios.post(
      `${pinataApiUrl}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: "Infinity",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return {
      success: true,
      hash: response.data.IpfsHash,
      url: `${pinataGateway}${response.data.IpfsHash}`,
    };
  } catch (error) {
    console.error("Error uploading file to IPFS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Upload JSON metadata to IPFS
export const uploadJSONToIPFS = async (jsonData) => {
  try {
    const response = await axios.post(
      `${pinataApiUrl}/pinning/pinJSONToIPFS`,
      jsonData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return {
      success: true,
      hash: response.data.IpfsHash,
      url: `${pinataGateway}${response.data.IpfsHash}`,
    };
  } catch (error) {
    console.error("Error uploading JSON to IPFS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get file from IPFS
export const getFromIPFS = async (hash) => {
  try {
    const response = await axios.get(`${pinataGateway}${hash}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Upload multiple files
export const uploadMultipleFiles = async (files) => {
  const results = [];
  for (const file of files) {
    const result = await uploadFileToIPFS(file);
    results.push(result);
  }
  return results;
};
