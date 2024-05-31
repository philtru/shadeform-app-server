require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const { v1: uuidV1, v4: uuidV4 } = require("uuid");

// Helpers
const { generateRandomIP } = require("./utils");

const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.use(cors());

const userInstances = [];

// Cached instances types
const instanceTypes = [];

app.get("/instances/types", async (req, res) => {
  if (instanceTypes.length > 0) {
    res.send(instanceTypes);
    return;
  }

  try {
    const response = await axios.get(
      "https://api.shadeform.ai/v1/instances/types",
      {
        params: {
          gpu_type: "A6000",
          num_gpus: 1,
          available: true,
          sort: "price",
        },
        headers: {
          "X-API-KEY": process.env.SHADEFORM_KEY,
        },
      }
    );
    const instances = response.data;
    instanceTypes.push(...instances?.instance_types);

    res.send(instances);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving instances");
  }
});

app.get("/instances", (req, res) => {
  res.send(userInstances);
});

app.post("/instances/create", async (req, res) => {
  const instanceData = req.body;

  // Check if required fields are present in the request
  if (
    !instanceData?.cloud ||
    !instanceData?.shade_instance_type ||
    !instanceData?.region ||
    !instanceData?.name
  ) {
    console.log("Error creating instance: Required fields are empty");
    return res
      .status(500)
      .send("Error creating instance: Required fields are empty");
  }

  const newInstanceId = uuidV4(); // Generate a unique instance ID
  const newIP = generateRandomIP(); // Generate a random IP address

  // Fetch instance types if not already cached
  if (instanceTypes.length === 0) {
    const response = await axios.get(
      "https://api.shadeform.ai/v1/instances/types",
      {
        params: {
          gpu_type: "A6000",
          num_gpus: 1,
          available: true,
          sort: "price",
        },
        headers: {
          "X-API-KEY": process.env.SHADEFORM_KEY,
        },
      }
    );
    const instances = response.data;
    instanceTypes.push(...instances?.instance_types);
  }

  const instanceMetadata = instanceTypes.find(
    (instance) =>
      instance.shade_instance_type === instanceData.shade_instance_type &&
      instance.cloud === instanceData.cloud
  );

  const newInstance = {
    // Instance metadata to get missing fields
    ...instanceMetadata,
    // Generated fields to create new instance
    id: newInstanceId,
    ip: newIP,
    status: "active",
    name: instanceData.name,

    // Required fields to create new instance
    cloud: instanceData.cloud,
    shade_instance_type: instanceData.shade_instance_type,
    region: instanceData.region,
    // Optional fields if presented
    os: instanceData?.os,
    shade_cloud: instanceData?.shade_cloud,
    ssh_key_id: uuidV1(),
    template: "",
  };

  // Store the new instance in the userInstances array
  userInstances.push(newInstance);

  res.json(newInstance);
});

app.delete("/instances/delete", (req, res) => {
  const instanceId = req.query.instanceId;
  const index = userInstances.findIndex(
    (instance) => instance.id === instanceId
  );
  if (index !== -1) {
    userInstances.splice(index, 1);
    res.send("Instance deleted successfully");
  } else {
    res.status(404).send("Instance not found");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
