import inquirer from "inquirer";
import { Storage } from "@google-cloud/storage";
import { readdirSync, unlinkSync, writeFileSync } from "fs";
import youtubedl from "youtube-dl-exec";
import createLogger from "progress-estimator";
import ora from "ora";
import { join } from "path";
import Parser from "rss-parser";
import { Podcast } from "podcast";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: __dirname + "/.env" });

export async function setup() {
    console.clear();
    const name = await inquirer.prompt({
        name: "name",
        type: "input",
        message: "What is your first name? ",
    });

    const hostingService = await inquirer.prompt({
        name: "hosting",
        type: "list",
        message: "Choose a hosting service: ",
        choices: ["Google Cloud"],
    });

    if (hostingService.hosting === "Google Cloud") {
        process.env.BUCKET_NAME = `${name.name}-youtube-rss`;
        writeFileSync(
            `${__dirname}/.env`,
            `BUCKET_NAME='${process.env.BUCKET_NAME}'`
        );
        await connectToGoogleDrive(name.name);
        await getUrl();
    }
}

export async function getUrl() {
    console.clear();
    const getUrlInput = async () => {
        const url = await inquirer.prompt({
            name: "url",
            message: "Paste a valid Youtube URL: ",
            type: "input",
        });
        return url;
    };

    let url = await getUrlInput();
    while (!isYouTubeURL(url.url)) {
        console.clear();
        url = await getUrlInput();
    }
    await downloadMP3(url.url);
    await uploadMP3();

    const option = await inquirer.prompt({
        name: "next",
        message: "Would you like to enter another URL?",
        type: "confirm",
        default: true,
    });

    if (option.next) {
        await getUrl();
    } else {
        process.exit();
    }
}

export async function downloadMP3(url) {
    try {
        const logger = createLogger({
            storagePath: join(__dirname, ".progress-estimator"),
        });

        const options = {
            x: true,
            "audio-format": "mp3",
            "audio-quality": "0",
            "path": __dirname,
        };

        const info = await youtubedl(url, {
            dumpSingleJson: true,
            "audio-format": "mp3",
            "audio-quality": "0",
        });
        let duration;
        if (info.duration_string) {
            const durationArr = info.duration_string.split(":");
            if (durationArr.length === 3) {
                duration = parseInt(durationArr[0] * 60);
            } else {
                duration = parseInt(durationArr[0]);
            }
        } else {
            duration = 1;
        }

        const promise = youtubedl(url, options);

        await logger(promise, `Downloading audio from ${url}`, {
            estimate: duration * 1300,
        });
    } catch (error) {
        console.error("Error downloading audio:", error);
    }
}

export async function uploadMP3() {
    async function uploadFile() {
        const spinner = ora("Uploading...");

        const bucketName = process.env.BUCKET_NAME;
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);
        const files = readdirSync(__dirname);
        const mp3File = files.find((file) => file.endsWith(".mp3"));
        const filePath = `${__dirname}/${mp3File}`;
        spinner.start();
        const res = await bucket.upload(filePath, { public: true });
        const upload = bucket.file(res[0].metadata.name);
        const url = upload.publicUrl();
        spinner.stop();
        const metadata = res[0].metadata;
        console.log(`File uploaded.`);
        unlinkSync(filePath);
        await addToRSS(url, metadata, bucketName);
    }

    await uploadFile().catch((err) => console.log("Error Uploading File"));
}

export async function addToRSS(publicUrlAudio, metadata, bucketName) {
    let parser = new Parser();
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    let file = bucket.file("rss_feed.xml");
    let publicUrl = file.publicUrl();
    let parsedFeed = await parser.parseURL(publicUrl);

    const newFeed = new Podcast({
        title: parsedFeed.title,
        description: parsedFeed.description,
        feedUrl: publicUrl,
        siteUrl: "github.com/lsherman98",
        author: bucketName.split("-")[0],
        docs: "github.com/lsherman98/youtube-rss",
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
    writeFileSync(`${__dirname}/rss_feed.xml`, xml);
    const cwd = __dirname;
    await bucket
        .upload(`${cwd}/rss_feed.xml`, {
            public: true,
            metadata: {
                cacheControl: "no-store, no-cache, max-age=0, must-revalidate",
            },
        })
        .catch((err) => console.log("Error Uploading XML"));
    unlinkSync(`${__dirname}/rss_feed.xml`);
    console.log(`Added to RSS - `, publicUrl);
}

export function isYouTubeURL(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url) === true;
}

export async function connectToGoogleDrive(name) {
    console.log("Connecting to Google Cloud");
    const bucketName = `${name.toLowerCase()}-youtube-rss`;
    const storage = new Storage();

    async function createBucket() {
        await storage
            .createBucket(bucketName, {
                metadata: {
                    retentionPeriod: 0,
                },
            })
            .then(() => console.log(`Bucket ${bucketName} created.`))
            .catch((err) => console.log("Bucket already exists."));
    }

    async function uploadFile() {
        const bucket = storage.bucket(bucketName);
        const cwd = __dirname;
        await bucket
            .upload(`${__dirname}/rss_feed.xml`, {
                public: true,
                metadata: {
                    cacheControl:
                        "no-store, no-cache, max-age=0, must-revalidate",
                },
            })
            .then(() => console.log(`File uploaded.`))
            .catch((err) => err);
    }

    await createBucket();

    const feed = new Podcast({
        title: `${name}'s RSS Feed`,
        description: "A private RSS feed using youtube-rss.",
        feedUrl: `https://storage.googleapis.com/${name}-youtube-rss/rss_feed.xml`,
        siteUrl: "github.com/lsherman98",
        author: name,
        docs: "github.com/lsherman98/youtube-rss",
    });

    const xml = feed.buildXml();
    writeFileSync(`${__dirname}/rss_feed.xml`, xml);
    await uploadFile().catch((err) => {"Error Uploading XML"; process.exit()});
    unlinkSync(`${__dirname}/rss_feed.xml`);
}
