import { auth, reports, tempContents } from "@qlik/api";
import fileSaver from "file-saver";

interface ReportStatusData {
  status: string;
  results?: Array<{
    location: string;
    outputId: string;
  }>;
}

interface ReportStatusResponse {
  data: ReportStatusData;
}

const ensureAuth = () => {
  auth.setDefaultHostConfig({
    host: "arqiva.uk.qlikcloud.com", 
    authType: "oauth2",
    clientId: "f6ec83d532eadf375cd98cfe709859df", 
    redirectUri: "https://192.168.1.128:5500/oauth_callback.html", 
    accessTokenStorage: "session",
    autoRedirect: true,
  });
};

export async function exportQlikObjectToExcel(appId: string, objectId: string) {
  try {
    ensureAuth();
    
    const viz = document.querySelector(`qlik-embed[object-id="${objectId}"]`) as any;
    if (!viz) throw new Error("Qlik visualization not found");

    await customElements.whenDefined('qlik-embed');
    await viz.updateComplete?.();

    const refApi = await viz.getRefApi();
    const doc = await refApi.getDoc();
    const qObj = await refApi.getObject();
    const layout = await qObj.getLayout();

    console.log("Creating temporary bookmark...");
    const bookmarkId = await doc.createTemporaryBookmark({
      qOptions: {
        qIncludeAllPatches: true,
        qIncludeVariables: true,
        qSaveVariableExpressions: true,
      },
      qObjectIdsToPatch: [layout.qInfo.qId],
    });
    console.log("Bookmark created:", bookmarkId);

    console.log("Creating report...");
    
    const reportPayload = {
      type: "sense-data-1.0" as "sense-data-1.0",
      meta: {
        exportDeadline: "P0Y0M0DT0H8M0S",
        tags: ["export"],
      },
      senseDataTemplate: {
        appId,
        id: layout.qInfo.qId,
        selectionType: "temporaryBookmarkV2" as "temporaryBookmarkV2", 
        temporaryBookmarkV2: { id: bookmarkId },
      },
      output: {
        outputId: "excelExport",
        type: "xlsx" as "xlsx", 
      },
    };
    
    console.log("Report payload:", JSON.stringify(reportPayload));
    
    const report = await reports.createReport(reportPayload);
    console.log("Report created:", report);

    const statusUrl = report.headers.get("content-location");
    console.log("Status URL:", statusUrl);
    
    const reportId = statusUrl?.match(/reports\/(.+?)\/status/)?.[1];
    if (!reportId) throw new Error("Failed to extract report ID");
    console.log("Report ID:", reportId);

    console.log("Waiting for export completion...");
    const result = await waitForExportCompletion(reportId);
    console.log("Export complete:", result);
    
    // eslint-disable-next-line no-useless-escape
    const downloadId = result.location.match(/\/([^/?#]+)(?:[?#]|$)/)?.[1];
    
    if (!downloadId) throw new Error("Failed to extract download ID");
    console.log("Download ID:", downloadId);
    
    console.log("Downloading file...");
    const file = await tempContents.downloadTempFile(downloadId, { inline: "1" });
    console.log("File downloaded:", file);

    console.log("Saving file...");
    fileSaver.saveAs(file.data as Blob, `${result.filename}-${new Date().toISOString()}.xlsx`);
    console.log("File saved successfully");
    
    return true;
  } catch (error) {
    console.error("Export error:", error);
    throw error;
  }
}

async function waitForExportCompletion(reportId: string): Promise<{ location: string; filename: string }> {
  return new Promise((resolve, reject) => {
    let checkCount = 0;
    const maxChecks = 30; 
    
    const interval = setInterval(async () => {
      try {
        checkCount++;
        console.log(`Checking export status (${checkCount}/${maxChecks})...`);
        
        const status: ReportStatusResponse = await reports.getReportStatus(reportId);
        console.log("Status response:", status);
        
        if (status.data.status === "done" && status.data.results && status.data.results.length > 0) {
          clearInterval(interval);
          resolve({
            location: status.data.results[0].location,
            filename: status.data.results[0].outputId,
          });
        } else if (status.data.status === "failed") {
          clearInterval(interval);
          reject(new Error("Export failed on the server"));
        } else if (checkCount >= maxChecks) {
          clearInterval(interval);
          reject(new Error("Export timed out after 90 seconds"));
        }
      } catch (err) {
        console.error("Error checking status:", err);
        clearInterval(interval);
        reject(err);
      }
    }, 3000);
  });
}