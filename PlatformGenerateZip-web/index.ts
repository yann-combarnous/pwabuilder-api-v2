﻿/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an orchestrator function.
 *
 * Before running this sample, please:
 * - create a Durable orchestration function
 * - create a Durable HTTP starter function
 * - run 'npm install durable-functions' from the wwwroot folder of your
 *   function app in Kudu
 */

import * as url from "url";
import { AzureFunction, Context } from "@azure/functions";
import * as JSZip from "jszip";
import { Manifest } from "../utils/interfaces";
import {
  PlatformGenerateZipInput,
  PlatformGenerateZipOutput,
} from "../utils/platform";
import { getBlobServiceClient, getManifestJson } from "../utils/storage";

type size = string;
type index = number;

const activityFunction: AzureFunction = async function (
  context: Context,
  input: PlatformGenerateZipInput
): Promise<PlatformGenerateZipOutput> {
  /*
    Zip: If image has generated metadata/tag name with ${name}-generated
  */
  const zip = new JSZip();
  const serviceClient = getBlobServiceClient();
  const containerClient = await serviceClient.getContainerClient(
    input.containerId
  );
  // Get manifest json and add to zip
  const manifest: Manifest = await getManifestJson(
    input.containerId,
    serviceClient
  );

  // Add icons and screenshots to zip
  const containerContents = containerClient.listBlobsFlat();

  const iconsMap: Map<size, index> = new Map();
  manifest.icons.forEach((icon, index) => {
    icon.sizes.split(" ").forEach((size) => {
      iconsMap.set(size, index);
    });

    iconsMap.set(icon.sizes, index);
  });
  const screenshotsMap: Map<size, index> = new Map();
  manifest.screenshots.forEach((screenshot, index) => {
    screenshot.sizes.split(" ").forEach((size) => {
      screenshotsMap.set(size, index);
    });

    screenshotsMap.set(screenshot.sizes, index);
  });

  for await (const blob of containerContents) {
    let size: string, purpose: string;
    const category = blob?.tags?.category;

    if (category === "icons") {
      [size, purpose] = blob.name.split("-");

      if (iconsMap.has(size)) {
        const iconManifestEntry = manifest.icons[iconsMap.get(size) as number];

        iconManifestEntry.src = new url.URL(
          iconManifestEntry.src,
          manifest.start_url
        ).toString();

        zip
          .folder("icons")
          ?.file(
            blob.name + "",
            containerClient.getBlobClient(blob.name).downloadToBuffer(),
            {
              base64: true,
            }
          );
      }
    } else if (category === "screenshots") {
      [size, purpose] = blob.name.split("-");

      if (screenshotsMap.has(size)) {
        const screenshotManifestEntry =
          manifest.screenshots[screenshotsMap.get(size) as number];

        screenshotManifestEntry.src = new url.URL(
          screenshotManifestEntry.src,
          manifest.start_url
        ).toString();

        zip
          .folder("screenshots")
          ?.file(
            blob.name + "",
            containerClient.getBlobClient(blob.name).downloadToBuffer(),
            {
              base64: true,
            }
          );
      }
    }
  }

  // write manifest to zip last
  zip.file("manifest.json", Buffer.from(manifest));
  // TODO finalize zip

  return {
    link: "testing",
  };
};

export default activityFunction;
