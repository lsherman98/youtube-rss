
# Youtube RSS CLI Tool

  

This tool accepts a link to a youtube video, converts it to MP3 and then adds it to a private RSS feed that you can subscribe to in your podcast app of choice.

  

>**NOTE: Before you can use this tool you must have the Google Cloud CLI tool installed.**  
>Installation Instructions - https://cloud.google.com/sdk/docs/downloads-interactive
>
>You then must run the following to add [default credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc#local-dev) for Google Cloud to your system:  
>```gcloud auth application-default login```

  
  

You can install the tool by running:

```

npm i yt-rss -g

```

or by cloning this repository and in the root directory of the project running:

```

npm i -g

```

  

You should then be able to run the tool from anywhere by simply running ```yt-rss``` in your terminal.

  

When you first run the tool, select the setup option, which will prompt you to login in to google cloud. After that you shouldn't have to setup again. If you do, your current rss file will be overwritten. You will also be responsible for hosting and streaming costs, so keep an eye on your billing dashboard in the Google Cloud Console.

  
  

# Errors

  

If you get the error: ```DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.```

  

Then go to ```node_modules/tr46/index.js``` and replace

```var punycode = require('punycode');``` with

```const punycode = require('punycode/');```

You will want to do the same in ```node_modules/whatwg-url/lib/url-state-machine.js```

  

If you installed the package globally using npm you can find where the global modules are stored by running ```npm root -g```

  

## Things still to be done

  

* Cleaner code, better error handling, more edge cases covered.

* Additional hosting options (AWS, etc)

* Ability to delete audio files stored in cloud from terminal

* Upgraded user experience

* Give users option to carry over previous rss feed file if running setup again.
