const express = require('express');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');
const {google} = require("googleapis")
const cors = require("cors");
var bodyParser = require('body-parser')
const axios = require("axios")

const app = express();

// Middleware
// parse application/x-www-form-urlencoded
app.use(bodyParser.json())
app.use(cors({origin:"*"}))
app.use(cookieParser());
app.use(session({ secret: 'asa', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Passport Twitter Strategy
passport.use(new TwitterStrategy({
    consumerKey: 'olWkKS9UpiJOe6hGshcfWh1zv',
    consumerSecret: 'k1V8D3jytgnV42i9t71meDhKQhK7qyTYFKchf685hG8KKyJMHm',
    callbackURL: 'http://localhost:5000/auth/twitter/callback',
},
function(token, tokenSecret, profile, done) {
     // In a real app, you would save the user details to your database
     console.log(token,"ggg")
    console.log(profile?.user?.username,"profile")
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Routes
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/');
});

app.post("/auth/google", async (req,res)=>{
    try {
        const authorizationCode = req.body.code;
  
        // Exchange authorization code for access token
        const { data } = await axios.post('https://oauth2.googleapis.com/token', {
          code: authorizationCode,
          client_id:
            '277653104935-2266rjc8p63uji7mq62qgodtj8s31b8c.apps.googleusercontent.com',
          client_secret: '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',
          redirect_uri: 'https://tvstartup.glamhiv.com',
          grant_type: 'authorization_code',
        });
  
        const accessToken = data.access_token;
        // console.log('data:', data);
  
        let oauth2Client = new google.auth.OAuth2(
          '277653104935-2266rjc8p63uji7mq62qgodtj8s31b8c.apps.googleusercontent.com',
          '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',
          'https://tvstartup.glamhiv.com',
        );
  
        // 'https://www.googleapis.com/auth/userinfo.email',
        // 'https://www.googleapis.com/auth/userinfo.profile',
        // 'https://www.googleapis.com/auth/youtube',
        // generate a url that asks permissions for Blogger and Google Calendar scopes
  
        oauth2Client.setCredentials({ access_token: accessToken });
  
        let oauth2 = google.oauth2({
          auth: oauth2Client,
          version: 'v2',
        });
  
        const getUserInfo = () => {
          return new Promise((resolve, reject) => {
            oauth2.userinfo.get((err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result.data);
              }
            });
          });
        };
  
        const responseData = await getUserInfo();
  
        // console.log('oauth2Client:', oauth2Client);
  
        // ********* For Youtube ********************
        const youtube = google.youtube({
          version: 'v3',
          auth: oauth2Client,
        });
  
    
        const scheduledStartTime = new Date();
        scheduledStartTime.setMinutes(scheduledStartTime.getMinutes() + 2)
        const liveBroadcastResponse = await youtube.liveBroadcasts.insert({
        part: 'snippet,status,contentDetails',
        requestBody: {
            snippet: {
                title: 'Scheduled Live Stream',
                scheduledStartTime: scheduledStartTime.toISOString(), // Specify the scheduled start time in ISO 8601 format
                description: 'This is a scheduled live stream'
            },
            status: {
                privacyStatus: 'public' // Set privacy status to public
            }
        }
    });

    // Extract the broadcast ID
    const broadcastId = liveBroadcastResponse.data.id;
    // Create a live stream associated with the broadcast
    const liveStreamResponse = await youtube.liveStreams.insert({
        part: 'snippet,cdn',
        requestBody: {
            snippet: {
                title: 'Scheduled Live Stream',
                description: 'This is a scheduled live stream',
            },
         
            cdn: {
              frameRate: 'variable',
              ingestionType: 'rtmp',
              resolution: 'variable',
              format: ''
          }
        }
    });

    // Extract the live stream ID
    const liveStreamId = liveStreamResponse.data.id;

    // Bind the live stream to the live broadcast
    await youtube.liveBroadcasts.bind({
        part: 'id,snippet,contentDetails',
        id: broadcastId,
        streamId: liveStreamId
    });

        res.status(200).json({
          response: responseData,
          accessToken:accessToken,
          broadcastId:broadcastId,
          streamData: liveStreamResponse?.data?.cdn?.ingestionInfo,
        });
      } catch (error) {
        // Handle errors appropriately

        res.status(500).json({error: error});
      }
})

app.get('/', (req, res) => {
    res.json({ user: req.user });
});


app.post('/livechat', async (req, res) => {
  try {
    // Create OAuth2 client with your client ID and client secret
    let oauth2Client = new google.auth.OAuth2(
      '277653104935-2266rjc8p63uji7mq62qgodtj8s31b8c.apps.googleusercontent.com',
      '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',
      'https://tvstartup.glamhiv.com',
    );


    // Set access token obtained during authentication
    oauth2Client.setCredentials({ access_token: req.body.accessToken });

    // Create YouTube Data API client
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    // Retrieve live broadcast details to get the live chat ID
    const broadcastResponse = await youtube.liveBroadcasts.list({
      part: 'snippet',
      id: req.body.broadcastId
    });

    const liveChatId = broadcastResponse.data.items[0]?.snippet?.liveChatId;

    if (!liveChatId) {
      throw new Error('Live chat ID not found');
    }

    // Fetch live chat messages
    const chatMessages = await youtube.liveChatMessages.list({
      part: 'snippet,authorDetails',
      liveChatId,
     
    });
console.log(chatMessages.data.items);
    // Extract messages from response
    const messages = chatMessages.data.items.map(item => ({
      author: item.authorDetails.displayName,
      id: item.id,
      message: item.snippet.textMessageDetails.messageText
    }));

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/livechat/messages', async (req, res) => {
  try {
    let oauth2Client = new google.auth.OAuth2(
      '277653104935-2266rjc8p63uji7mq62qgodtj8s31b8c.apps.googleusercontent.com',
      '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',
      'https://tvstartup.glamhiv.com',
    );


    oauth2Client.setCredentials({ access_token: req.body.accessToken });

    // Create YouTube Data API client
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    // Retrieve live chat ID associated with the live broadcast
    const response = await youtube.liveBroadcasts.list({
      part: 'snippet',
      id: req.body.broadcastId
    });

    // Extract live chat ID from response
    const liveChatId = response.data.items[0]?.snippet?.liveChatId;

    if (!liveChatId) {
      throw new Error('Live chat ID not found');
    }

    // Insert a new live chat message
    const chatResponse = await youtube.liveChatMessages.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: req.body.message
          }
        }
      }
    });

    console.log('Live chat message sent:', chatResponse.data);

    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
