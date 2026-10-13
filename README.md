# Star Sweets

## Instagram gallery

The `/gallery` page reads recent posts from `@star.sweets25` through the Instagram API with Instagram Login. It needs one secret: an **Instagram User access token** for that account. You do not need an Instagram account ID or a Facebook Page access token for this integration. The Meta developer login and the Instagram login may belong to different accounts. An Instagram **Business or Creator** account is a professional account type; it does not mean you need to submit company registration documents for a gallery that only reads your own account. Use Meta's **Standard Access** with your Instagram account assigned a role on the developer app. Business verification can be required if you later seek Advanced Access for other people's accounts.

Use **Instagram API with Instagram Login** for this automatic gallery. oEmbed takes the URL of one known public post and returns embed HTML; it does not list recent posts from your account. Meta made tokenless oEmbed requests available in June 2026, so it can be useful for manually selected embeds without app review. This gallery uses the Instagram media endpoint to list your own posts instead.

### 1. Get the Instagram token from Meta

1. Make sure `@star.sweets25` is an Instagram **Business or Creator** account. Sign in to [Meta for Developers](https://developers.facebook.com/apps/) with the Facebook or Meta account that will manage the developer app. This is the app administrator's sign-in; it does not have to be the `@star.sweets25` Instagram login.
2. Create a Meta app for the site and add the **Instagram API** use case or product. Choose **API setup with Instagram login**, sometimes labeled **Instagram business login**. Use **Standard Access** for `instagram_business_basic`; this gallery reads only your connected account's posts. Do not request Advanced Access for this use case.
3. If Meta's app dashboard requires an Instagram tester, go to **App Roles → Roles → Instagram Testers**, add `star.sweets25`, then sign in to that Instagram account in a browser and open [Apps and Websites](https://www.instagram.com/accounts/manage_access/) to accept the invitation under **Tester Invites**. If the phone app has no Tester Invites tab, use Safari on that phone and request the desktop website if needed. The account holder can do this on their own device; the app administrator and Instagram tester can be different accounts.
4. In the Instagram API setup's **Generate access tokens** section, choose **Add account** and sign in to `@star.sweets25`. Authorize the app to read that account's content.
5. Choose **Generate token** next to `@star.sweets25`. Copy the **Instagram User access token** when Meta displays it. Keep it private. See [Meta's Instagram API documentation](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login) for the login type and permission name.

If Meta asks for registered-business documents, check whether you selected **Business Verification** or **Advanced Access**. Those are not part of this one-account Instagram Login setup. If the standard setup itself blocks token generation, keep the exact wording of Meta's prompt so the requirement can be identified before changing the account or app.

### 2. Connect the local site

Until Instagram is connected, `/gallery` shows six image placeholders with lorem ipsum filler text. It makes no Instagram request without a token. Once `INSTAGRAM_ACCESS_TOKEN` is set, the gallery uses the account's posts and no longer shows placeholders. In local development, `/gallery?preview=1` forces the placeholder view for layout review even after connecting Instagram. Placeholder cards have no links.

1. In the project root, add this line to `.env`, replacing the sample value with the token from Meta:

   ```dotenv
   INSTAGRAM_ACCESS_TOKEN=your_token_from_meta
   ```

2. Restart the local server with `npm run dev`, then open `http://localhost:4321/gallery`.
3. Confirm that the page shows posts from `@star.sweets25` and that a card opens its original Instagram post. The page shows a link to Instagram if the token is missing or no usable posts are returned.

The `.env` file is ignored by Git. Keep the name exactly `INSTAGRAM_ACCESS_TOKEN`; a `PUBLIC_` prefix would expose the token to browsers.

### Edit the gallery in Sanity

You can change the text under the Gallery heading in Sanity even while the page shows placeholder cards. Once Instagram is connected, you can also write each card's description or hide a post without deleting it from Instagram:

1. Open the [Star Sweets Sanity Studio](https://star-sweets.sanity.studio/) and select **Instagram Gallery** in the left menu.
2. Edit **Gallery description** for the text below the page heading.
3. Under **Post descriptions and visibility**, open the post you want to edit. Each entry shows its Instagram link and post code. Write a **Description shown on the gallery card**, or enable **Hide this post from the gallery**.
4. Click **Publish**, then refresh `/gallery`. Sanity may take a short time to update its cached public data. To restore a hidden post, turn off its hide switch or remove its entry, then publish again.

Instagram supplies only the post image and link. The site never requests or displays Instagram captions. Cards without a Sanity description show no description. The temporary lorem ipsum cards remain visible until the Instagram token is connected; `/gallery?preview=1` always keeps lorem ipsum text for layout review. This setting does not change the separate **Past Orders Gallery** content used on the home and order pages. The website reads published settings from Sanity, so no Sanity write token is needed for this feature. If Sanity cannot be reached while Instagram is connected, the gallery shows an unavailable message instead of displaying posts that may have been hidden.

The site reads the Instagram feed directly, while Sanity stores the editable descriptions and visibility settings. Run `npm run gallery:sync` from the project folder when you add new Instagram posts. The command adds recent posts to the Sanity list without changing descriptions or hidden settings you have already saved. It needs `INSTAGRAM_ACCESS_TOKEN`, `SANITY_PROJECT_ID`, and `SANITY_WRITE_TOKEN` in the local `.env` file. Refresh Sanity Studio after it finishes.

### 3. Connect the deployed site

In Vercel, open the Star Sweets project, go to **Settings → Environment Variables**, and add `INSTAGRAM_ACCESS_TOKEN` with the same token. Select the **Production** environment, save it, and redeploy so the server receives the new value. Add it to **Preview** as well if you want preview deployments to show the gallery.

### Keep it working

The page requests up to 24 recent posts and caches a successful response for 15 minutes per running server instance. The token is not refreshed automatically. Before it expires, generate or refresh it in Meta, replace `INSTAGRAM_ACCESS_TOKEN` locally and in Vercel, and redeploy. If the gallery stays empty, check that the token belongs to `@star.sweets25`, has `instagram_business_basic`, and has not expired. The server log will show a failed Instagram request without printing the token.

## Cupcake inspiration in the order form

The cupcake picker uses **Past Orders Gallery** photos in Sanity, separate from the Instagram gallery. To add a photo, open a Past Orders Gallery entry (or create one), choose **Cupcakes** under **Show in order form for**, add a caption and photo, then publish. Photos without that choice stay in the cake picker. Until a cupcake photo is published, customers can still upload their own cupcake reference images.

An order can include up to three selected styles and five uploaded images for each of cakes and cupcakes. All uploaded reference images together must be 4 MB or smaller. Cupcake selections and uploads appear in the order document and both order emails.
