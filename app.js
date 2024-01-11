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
          redirect_uri: 'http://localhost:4000',
          grant_type: 'authorization_code',
        });
  
        const accessToken = data.access_token;
        // console.log('data:', data);
  
        let oauth2Client = new google.auth.OAuth2(
          '277653104935-2266rjc8p63uji7mq62qgodtj8s31b8c.apps.googleusercontent.com',
          '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',
          'http://localhost:4000',
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
  
        // Set the required scopes
  
        // Check if the authentication token has the required scopes
        // const currentScopes = oauth2Client.scopes;
        // console.log('currnetScopes:', oauth2Client);
        // const missingScopes = requiredScopes.filter(
        //   (scope) => !currentScopes.includes(scope),
        // );
  
        // Creating live broadcast
        const broadcastResponse = await youtube.liveStreams.insert({
          requestBody: {
            snippet: {
              title: 'Testing stream',
              description: 'This is for Testing purpose',
            },
            status: {
              streamStatus: 'active',
            },
            cdn: {
              frameRate: 'variable',
              ingestionType: 'rtmp',
              resolution: 'variable',
              format: '',
            },
            contentDetails: {
              isReusable: true,
            },
            kind: "youtube#liveStream",
          },
          part: ['snippet,status,contentDetails,cdn'],
        });
  
        // const broadCastId = broadcastResponse.data.id;
  
  
        // Fetch user data using the access token
        // const { data: userData } = await axios.get(
        //   'https://www.googleapis.com/oauth2/v2/userinfo',
        //   {
        //     headers: {
        //       Authorization: `Bearer ${accessToken}`,
        //     },
        //   },
        // );
  
        // Now you have the user data
        // You can send it as a JSON response or perform other actions based on your requirements
        res.status(200).json({
          response: responseData,
          streamData: broadcastResponse?.data?.cdn?.ingestionInfo,
        });
      } catch (error) {
        // Handle errors appropriately

        res.status(500).json({error: error});
      }
})

app.get('/', (req, res) => {
    res.json({ user: req.user });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
