import inquirer from "inquirer";
import { Storage } from "@google-cloud/storage";
import { readdirSync, unlinkSync, writeFileSync } from "fs";
import youtubedl from "youtube-dl-exec";
import createLogger from "progress-estimator";
import ora from "ora";
import { join, parse } from "path";
import RSS from "rss";
import Parser from "rss-parser";
import { Podcast } from "podcast";

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
        const spinner = ora("Uploading...");

        const bucketName = "levi-youtube-rss";
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);
        const files = readdirSync(process.cwd());
        const mp3File = files.find((file) => file.endsWith(".mp3"));
        const filePath = `${process.cwd()}/${mp3File}`;
        spinner.start();
        const res = await bucket.upload(filePath, { public: true });
        const upload = bucket.file(res[0].metadata.name)
        const url = upload.publicUrl()
        spinner.stop();
        const metadata = res[0].metadata;
        console.log(`File uploaded.`);
        unlinkSync(filePath);
        addToRSS(url, metadata, bucketName);
    }

    await uploadFile().catch((err) => console.log(err));
}

export async function addToRSS(publicUrlAudio, metadata, bucketName) {
    let parser = new Parser();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    let file = bucket.file("feed.xml");
    let publicUrl = file.publicUrl();
    let parsedFeed = await parser.parseURL(publicUrl);

    const newFeed = new Podcast({
        title: parsedFeed.title,
        description: parsedFeed.description,
        feedUrl: publicUrl,
        site_url: "",
        author: "",
    });

    newFeed.addItem({
        title: metadata.name,
        description: "",
        url: publicUrlAudio,
        date: new Date(),
        enclosure: {
            url: publicUrlAudio,
            size: metadata.size,
            type: metadata.contentType,
        },
    });

    parsedFeed.items.forEach((item) => {
        console.log(item)
        newFeed.addItem({
            title: item.title,
            description: "",
            url: item.link,
            date: item.date,
            enclosure: {
                url: item.link,
                size: item.enclosure.size,
                type: item.enclosure.type,
            },
        });
    });

    const xml = newFeed.buildXml();
    writeFileSync("./feed.xml", xml);
    const cwd = process.cwd();
    await bucket
        .upload(`${cwd}/feed.xml`, {
            public: true,
            metadata: {
                cacheControl: "no-store, no-cache, max-age=0, must-revalidate",
            },
        })
        .catch((err) => console.log(err));
    console.log(publicUrl);
    console.log(`RSS Updated`);
}

export async function initRSS() {}

export function isYouTubeURL(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url) === true;
}

export async function connectToGoogleDrive(name) {
    console.log("connecting to google drive");
    const bucketName = `${name.toLowerCase()}-youtube-rss`;
    const storage = new Storage();

    async function createBucket() {
        await storage.createBucket(bucketName, {
            metadata: {
                retentionPeriod: 0,
            },
        });
        console.log(`Bucket ${bucketName} created.`);
    }

    async function uploadFile() {
        const bucket = storage.bucket(bucketName);
        const cwd = process.cwd();
        await bucket.upload(`${cwd}/feed.xml`, {
            public: true,
            metadata: {
                cacheControl: "no-store, no-cache, max-age=0, must-revalidate",
            },
        });
        console.log(`File uploaded.`);
    }

    await createBucket().catch((err) => console.log(err));

    const feed = new Podcast({
        title: `${name}'s RSS Feed`,
        description: "",
        feed_url: "",
        site_url: "",
        author: "",
    });

    const xml = feed.buildXml();
    writeFileSync("./feed.xml", xml);
    await uploadFile().catch((err) => console.log(err));
}
