import inquirer from "inquirer";
import { Storage } from "@google-cloud/storage";
import { readdirSync, unlinkSync } from "fs";
import youtubedl from "youtube-dl-exec";
import createLogger from "progress-estimator";
import ora from "ora";
import { join } from "path";

export async function setup() {
    const name = await inquirer.prompt({
        name: "name",
        type: "input",
        message: "What is your first name? ",
    });

    const hostingService = await inquirer.prompt({
        name: "hosting",
        type: "list",
        message: "Choose a hosting service: ",
        choices: ["Google Cloud", "AWS"],
    });

    if (hostingService.hosting === "Google Cloud") {
        await connectToGoogleDrive(name.name);
        await getUrl();
    }
}

export async function getUrl() {
    const getUrlInput = async () => {
        const url = await inquirer.prompt({
            name: "url",
            message: "Paste a valid Youtube Url:",
            type: "input",
        });
        return url;
    };

    let url = await getUrlInput();
    while (!isYouTubeURL(url.url)) {
        console.log("Please enter a valid Url.");
        url = await getUrlInput();
    }
    await downloadMP3(url.url);
    await uploadMP3();
}

export async function downloadMP3(url) {
    try {
        const logger = createLogger({
            storagePath: join(process.cwd(), ".progress-estimator"),
        });

        const options = {
            x: true,
            "audio-format": "mp3",
            "audio-quality": "0",
        };

        const promise = youtubedl(url, options);
        await logger(promise, `Downloading audio from ${url}`);
    } catch (error) {
        console.error("Error downloading audio:", error);
    }
}

export async function uploadMP3() {
    async function uploadFile() {
        const logger = createLogger({
            storagePath: process.cwd() + ".progress-estimator",
        });
        const spinner = ora("Uploading...")

        const bucketName = "levi-youtube-rss";
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);
        const files = readdirSync(process.cwd());
        const mp3File = files.find((file) => file.endsWith(".mp3"));
        const filePath = `${process.cwd()}/${mp3File}`;
        spinner.start()
        const res = await bucket.upload(filePath);
        spinner.stop()
        const metadata = res[0].metadata;
        console.log(`File uploaded.`);
        unlinkSync(filePath);
        addToRSS(metadata)
    }

    await uploadFile().catch((err) => console.log(err));
}

export async function addToRSS(metadata) {
    
}

export async function initRSS() {}

export function isYouTubeURL(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url) === true;
}

export async function connectToGoogleDrive(name) {
    console.log("connecting to google drive");
    const bucketName = `${name}-youtube-rss`;
    const storage = new Storage();

    async function createBucket() {
        await storage.createBucket(bucketName);
        console.log(`Bucket ${bucketName} created.`);
    }

    async function uploadFile() {
        const bucket = storage.bucket(bucketName);
        const cwd = process.cwd();
        await bucket.upload(`${cwd}/rss.xml`);
        console.log(`File uploaded.`);
    }

    await createBucket().catch((err) => console.log(err));
    await uploadFile().catch((err) => console.log(err));
}
