# Van Gogh Shader Transcript

The following is a formatted (by ChatGPT) transcript from [
I Tried Making a Real-Time Painterly Renderer, Van Gogh Style](https://youtu.be/e06OM1XonA8) (by Yusef28) on creating a painterly shader in the style of Vincent van Gogh.

[Generated Tutorial](./Tutorial.md)

---

## Introduction

Hi everyone. This is a shader I wrote that renders video and games as realtime moving paintings. In this video, I'll explain exactly how I made it, and then I'll apply it to some games using ReShade.

Unlike the blended colors of Michelangelo or the long strokes of Edvard Munch, Vincent's signature style is unblended, short, fast strokes throughout the painting.

So, the first thing I experimented with was just drawing random circles colored based on the color at that circle's position in the original image. If we hold on to what we painted last frame, then when we mix in more circles each frame, they'll layer nicely.

The major problem with this approach is that if we want a realtime effect, we need the whole canvas to basically refresh itself by drawing circles over previous circles. If we tried to fix this by just drawing more circles each frame, it would be too slow.

## Procedural Voronoi

In order to allow for more paint strokes in less time, I decided to use an approach that I haven't seen covered, at least on YouTube, that is the procedural Voronoi algorithm.

I have two videos explaining this technique in depth, as well as one showing an application of it to make an ASCII renderer with moving characters.

To briefly explain, though, we start with an instance grid of circles, but each cell will be drawing what it can of its eight immediate neighbors as well as itself. That way, we can move the circles around and it still looks continuous.

So I set up the circle coloring inside the basic Voronoi algorithm. Then I added the time uniform to a function, so we get new circle positions over time that will fill the whole canvas for the price of only nine circles drawn by any pixel, and it's fast enough for realtime.

## Stroke Direction

To make things seem more painted, I tried stretching the circles. As soon as I tried that, though, I noticed that the strokes being vertical kind of ruins the effect.

Looking at Van Gogh and painting in general, you can see that in most cases we follow the natural direction of the thing we were trying to paint.

So I started with what I knew: how to find the difference of brightness between two pixels. More technically, this is finding the gradient, or approximating the derivative.

I used the grayscale version of the image and tested the brightness a bit to the left and to the right of the current pixel, and a bit below and above. This gives us the gradient around our point on the X and Y axes.

If you color the image just based on these two components, you get this.

If you look closely, you'll see that a line perpendicular to any gradient direction gives us the correct painting direction.

To actually rotate the strokes the right way, I call the atan function on the new direction vector, which gives us an angle we can use in a 2D rotation matrix to rotate the strokes.

Initially, there were a lot of small gradient changes, which meant the angle would flicker too much. My cheap solution was to use a lower-resolution version of the video using mipmapping.

This blurring of the gradient, however you achieve it, is what allows for that nice flowy look.

## Understanding Van Gogh's Strokes

To understand what Van Gogh's paint strokes were like, we should understand something about him.

It would be accurate to describe Van Gogh as obsessed. He produced over 900 paintings within a seven-year painting career, and 70 of those were completed in his last 70 days of life, where he completed at least one painting a day.

He wanted to make as many paintings as possible, so every stroke was hurried. At the same time, his strokes were used to describe texture, bouncing light, and many other ideas.

So how can we approach something so human with code?

Instead of a circle as the paint stroke, let's start with a rectangle. We'll use the red channel of a metal texture as the base texture of our paint stroke.

We'll stretch it out, threshold it, and apply it as a mask. After that, we'll add some curves to the length and width of the stroke to make it feel more natural and alive.

Now, it took a lot of tweaking of the code over a few weeks to get from here to a paint stroke I actually liked, so I'll say more on that later.

### Multiple Levels of Detail

Without any other levels of detail, especially in realtime, it will be hard to make out any objects at all with the shader unless the strokes are really small.

Ideally, we could paint big strokes where there's less detail and small strokes where there's more detail.

We can call the function multiple times at different grid scales and pass the result between rounds, so we paint in layers.

The problem is, if we just draw a full layer for each level of detail, we might as well only draw the top layer, since it'll hide the others anyway.

To fix this, we need to detect areas with more detail and only draw high-detail paint strokes in those areas. And this check has to be done for each neighbor of the Voronoi algorithm to avoid discontinuities.

So how can we decide which areas are high detail?

I had the code for an edge-detection algorithm laying around that takes the length of the gradient vector to make the edges. It's actually way more accurate than just using the grayscale of the gradient.

So I used that with a mipmap level of three and thresholded it to just spread the high-detail areas out more.

### Color

Right now, we use the colors of the original image because, of course, we want to render it as accurately as possible.

But that's not how Van Gogh did it.

Van Gogh didn't just paint what he saw. He painted how what he saw made him feel.

In his painting The Night Café, which he called one of the ugliest paintings he ever made, he was trying to express his distaste for the nightlife in Paris.

One way he did this was by intentionally using color combinations that were ugly.

Beyond that, once he became influenced by the Impressionist painters of Paris, he generally pushed for high-contrast and vibrant colors in his paintings.

So my first ideas are to pass the original stroke color through this palette function that a lot of ShaderToy users are into. With a few tweaks, that gives us more variety to shift the colors of the whole scene.

I wrote code to index a lookup table. These let you map your RGB colors to another set of RGB colors for color grading. They're used a lot in the film industry.

And while it took me a little bit to get my head around it, I found it was very satisfying when I got it working.

To be honest, I think some of these lookup tables make things look less attractive, and I think that's the point. If you want to express a bad mood, you should be able to find a lookup table that fits that.

### Impasto and Lighting

All right, so there's only one major thing missing.

Vincent often painted with an impasto style, which meant the paint would rise up off the canvas.

If you think about it, it's basically bump mapping long before bump mapping was invented.

To get the right height for this, I use a low-resolution sample of the same texture I was using for the paint texture.

To top it off, I generated another SDF rectangle and used it to push down the height away from the edges of the stroke shape. That makes it look like a paintbrush was feverishly ripped through paint on the canvas.

To get the normal from these heights, I use the same gradient function from before. Then I wrote a basic lighting model with a ray direction and light, all in 3D space.

So we have a 3D system that can calculate diffuse and specular lighting, which gives us this.

Our final—well, semi-final—result.

### Improving the Result

Okay, so I did all that work, and the results look nothing like a Van Gogh painting.

There are huge strokes in the first layer, which could be a fun variation, but they're too similar to each other. Overall, this isn't something you would look at and say, "Oh, it's like Van Gogh."

I think part of it is I didn't spend enough time looking at reference images while coding, and I just went off the rails.

I couldn't let this project rest as it was, so I ended up improving it.

I improved the variety of the strokes. That was tricky because it was as if Van Gogh often tried to make the strokes the same, but he was also in a hurry. So this is my attempt at that.

Then I realized it looked kind of odd to have all the strokes refresh each frame, so I hacked together some sort of motion-detection algorithm.

It's mostly made up, but it does look like the color only shows up where stuff moves. So I applied that as part of the conditional to determine if we draw a stroke.

The only issue was it was only updating right on the frame where things had moved. Which wasn't enough to redraw everything that needed to be redrawn.

So I added a sort of ghosting effect, which gives the main algorithm more time to redraw paint.

That leads to this.

I think this is most useful in scenes like a webcam in an empty room or a green-screen effect, where you would expect a lot of stillness in the background.

### Paint Blending

I also added a sort of color blending where the algorithm looks at what's already on the canvas and spreads some of that color into its new color based on the UVs.

I did this along the natural direction and also the perpendicular, so it looks like paint that was left on the brush is also being added to the next stroke.

One thing I didn't get to was adding the Kubelka-Munk theory, which lets us blend colors based on actual pigment.

For example, in the RGB space, halfway between blue and yellow is gray. With real paint, you would expect green.

There's a whole physically based equation for doing that, but it requires a lot of setup, so that would be a good future project.

I also would have loved to restrict the color palette more or remap it to the sort of colors Van Gogh used, but I didn't get there.

Incidentally, images of things like sunflowers and almond trees in their natural environment fit this color scheme pretty well.

> NOTE: remaining content trimmed to focus on instruction vs game implementation steps. See original transcript below for more details.

---

## Original Transcript w/ Timestamps from YouTube

```
Search transcript

0:000 seconds[Music]
0:022 secondshi everyone this is a Shader I wrote that renders video and games as realtime moving paintings in this video I'll explain
0:1010 secondsexactly how I made it and then I'll apply it to some games using reshade unlike the Blended colors of
0:1818 secondsMichelangelo or the long strokes of Edward Munch Vincent's signature style is unblended short fast Strokes throughout the painting so the first
0:2626 secondsthing I experimented with was just drawing random circles colored based on the color at that circle's position in the original image If We Hold On To What
0:3535 secondsWe painted last frame then when we mix in more circles each frame they'll layer nicely the major problem with this approach is that if we want a real-time
0:4444 secondseffect we need the whole canvas to basically refresh Itself by drawing circles over previous circles if we tried to fix this by just drawing more
0:5252 secondscircles each frame it would be too
0:5555 seconds[Music]
0:5757 secondsslow in order to allow for more paint Strokes in less time I decided to use an approach that I haven't seen covered at
1:041 minute, 4 secondsleast on YouTube that is the procedural voro algorithm I have two videos explaining this technique in depth as well as one showing an application of it
1:131 minute, 13 secondsto make an asku renderer with moving characters to briefly explain though we start with an instance grid of circles
1:201 minute, 20 secondsbut each cell will be drawing what it can of its eight immediate neighbors as well as itself that way we can move the circles around and it still looks
1:281 minute, 28 secondscontinuous so I set up the circle coloring inside the basic foro algorithm then I added the time uniform to a t
1:351 minute, 35 secondsfunction so we get new Circle positions over time that will fill the whole canvas for the price of only Nine Circles drawn by any pixel and is fast
1:431 minute, 43 secondsenough for real time to make things seem more painted I tried stretching the circles as soon as I tried that though I noticed that The Strokes being vertical
1:521 minute, 52 secondskind of ruins the effect looking at Van go and painting in general you can see that in most cases we follow the natural direction of the thing we were trying to
2:002 minutespaint so I started with what I knew how to find the difference of brightness between two pixels more technically this
2:072 minutes, 7 secondsis finding the gradient or approximating the derivative I used the grayscale version of the image and tested the brightness a bit to the left and to the
2:152 minutes, 15 secondsright of the current pixel and a bit below and above this gives us the gradient around our point on the X and Y AIS if you color the image just based on
2:232 minutes, 23 secondsthese two components you get this if you look closely you'll see that a line perpendicular to any grading Direction gives us the correct painting direction
2:322 minutes, 32 secondsto actually rotate The Strokes the right way I call the aan function on the new Direction Vector which gives us an angle we can use in a 2d rotation Matrix to
2:412 minutes, 41 secondsrotate The Strokes initially there were a lot of small gradient changes which meant the angle would flicker too much my cheap solution was to use a lower
2:492 minutes, 49 secondsresolution version of the video using mid mapping this blurring of the gradient however you achieve it is what allows for that nice flowy
2:572 minutes, 57 secondslook to understand what van van Go's paint Strokes were like we should understand something about him it would be accurate to describe van go as
3:053 minutes, 5 secondsobsessed he produced over 900 paintings within a 7-year painting career and 70 of those were completed in his last 70
3:133 minutes, 13 secondsdays of life where he completed at least one painting a day he wanted to make as many paintings as possible so every stroke was hurried at the same time his
3:223 minutes, 22 secondsStrokes were used to describe texture bouncing of light and many other ideas so how can we approach something so
3:283 minutes, 28 secondshuman with code instead of a circle as the paint stroke let's start with a rectangle we'll use the red channel of a
3:363 minutes, 36 secondsmetal texture as the base texture of our paint stroke we'll stretch it out threshold it and apply it as a mask after that we'll add some curves to the
3:453 minutes, 45 secondslength and width of the stroke to make it feel more natural and Alive now it took a lot of tweaking of the code over a few weeks to get from here to a paint
3:543 minutes, 54 secondsstroke I actually liked so I'll say more on that later without any other levels of detail especially in real time it
4:014 minutes, 1 secondwill be hard to make out any objects at all with the Shader unless The Strokes are really small ideally we could paint big Strokes where there's less detail
4:094 minutes, 9 secondsand small Strokes where there's more detail we can call the function multiple times at different grid scales and pass the result between rounds so we paint in
4:174 minutes, 17 secondslayers the problem is if we just draw a full layer for each level of detail we might as well only draw the top layer since it'll hide the others anyways to
4:264 minutes, 26 secondsfix this we need to detect areas with more detail and only draw hide detail paint Strokes in those areas and this check has to be done for each neighbor
4:334 minutes, 33 secondsof the voro algorithm to avoid discontinuities so how can we decide which areas are high detail I had the
4:404 minutes, 40 secondscode for an edge detection algorithm laying around that takes the length of the gradient Vector to make the edges it's actually way more accurate than
4:484 minutes, 48 secondsjust using the gray scale of the gradient so I used that with a mid map level of three and threshold it to just
4:554 minutes, 55 secondsspread the high detail areas out more right now we use the colors of the
5:025 minutes, 2 secondsoriginal image because of course we want to render it as accurately as possible but that's not how van go did it van go didn't just paint what he saw he painted
5:115 minutes, 11 secondshow what he saw made him feel in his painting the night Cafe one which he called one of the ugliest paintings he ever made he was trying to express his
5:195 minutes, 19 secondsdistaste for the night life in Paris one way he did this was by intentionally using color combinations that were ugly beyond that once he became influenced by
5:285 minutes, 28 secondsthe impressionist painter of pairs he generally pushed for high contrast and vibrant colors in his paintings so my
5:355 minutes, 35 secondsfirst ideas are to pass the original stroke color through this pallet function that a lot of Shader Tor users are into with a few tweaks that gives us
5:435 minutes, 43 secondsmore variety to shift the colors of the whole scene I wrote code to index a lookup table these let you map your RGB
5:515 minutes, 51 secondscolors to another set of RGB colors for color grading they're used a lot in the film industry and while it took me a
5:585 minutes, 58 secondslittle bit to get my head around found it was very satisfying when I got it working to be honest I think some of these lookup tables make things look
6:056 minutes, 5 secondsless attractive and I think that's the point if you want to express a bad mood you should be able to find a lookup table that fits
6:136 minutes, 13 secondsthat all right so there's only one major thing missing Vincent often painted with an impasto style which meant the paint
6:216 minutes, 21 secondswould rise up off the canvas if you think about it it's basically bump mapping long before bump mapping was invented to get the right height for
6:286 minutes, 28 secondsthis I use a low resolution sample of the same texture I was using for the paint texture to top it off I generated
6:356 minutes, 35 secondsanother SDF rectangle and used it to push down the height away from the edges of the stroke shape that makes it look like a paintbrush was feverishly ripped
6:446 minutes, 44 secondsthrough paint on the canvas to get the normal from these Heights I use the same gradient function from before then I wrote a basic lighting model with a ray
6:536 minutes, 53 secondsDirection and light all in 3D space so we have a 3D system that can calculate diffuse and specular lighting which
7:007 minutesgives us this our final well semi-final result okay so I did all that work and the results look nothing like a van go
7:077 minutes, 7 secondspainting there are huge Strokes in the first layer which could be a fun variation but they're too similar to each other overall this isn't something
7:157 minutes, 15 secondsyou would look at and say oh it's like van go I think part of it is I didn't spend enough time looking at reference images while coding and I just went off
7:227 minutes, 22 secondsthe rails I couldn't let this project rest as it was so I ended up improving it I improved the variety of the Strokes
7:307 minutes, 30 secondsthat was tricky because it was as if Fango often tried to make The Strokes the same but he was also in a hurry so this is my attempt at that then I
7:387 minutes, 38 secondsrealized it looked kind of odd to have all The Strokes refresh each frame so I hacked together some sort of motion detection algorithm it's mostly made up
7:477 minutes, 47 secondsbut it does look like the color only shows up where stuff moves so I applied that as part of the conditional to determine if we draw a stroke the only
7:547 minutes, 54 secondsissue was it was only updating right on the frame where things had moved which wasn't enough to redraw everything that needed to be redrawn so I added a sort
8:028 minutes, 2 secondsof ghosting effect which gives the main algorithm more time to redraw paint that leads to this I think this is most useful in scenes like a webcam in an
8:108 minutes, 10 secondsempty room or a green screen effect where you would expect a lot of Stillness in the
8:198 minutes, 19 secondsbackground I also added a sort of color blending where the algorithm looks at what is already on the canvas and spread some of that color into its new color
8:278 minutes, 27 secondsbased on the UVS I did this along the natural Direction and also the perpendicular so it looks like paint that was left on the brush is also being
8:358 minutes, 35 secondsadded to the next stroke one thing I didn't get to was
8:428 minutes, 42 secondsadding the Cela monk Theory which lets us blend colors based on actual pigment for example in the RGB space halfway
8:508 minutes, 50 secondsbetween blue and yellow is gray with a real paint you would expect green there's a whole physically based equation for doing that but it requires
8:588 minutes, 58 secondsa lot of setup so that would would be a good future project also I would have loved to restrict the color palette more or remap it to the sort of colors van go
9:069 minutes, 6 secondsused but I didn't get there incidentally images of things like sunflowers and almond trees in their natural
9:139 minutes, 13 secondsenvironment fit this color scheme pretty well
9:249 minutes, 24 seconds[Music]
9:319 minutes, 31 secondswith that done I really wanted to know how this would work in a game Reade is an open- Source post-processing injector for games and video software it was
9:399 minutes, 39 secondsdeveloped by a solo developer named crossy the basic setup is run the exe point to a game and choose the right Graphics API if you haven't memorized
9:489 minutes, 48 secondsthe graphics apis of all your Steam games Reay provides a Search tool to find it after that the next time you start the chosen game Reade will be
9:579 minutes, 57 secondsaccessible for more shaders you can choose to install more from the provided list or add your own I decided to Port each piece of this project as an
10:0610 minutes, 6 secondsindividual Shader to get a feel for the system after that I put it all together using passes and render
10:1310 minutes, 13 secondstextures the only major issue I ran into was the default format for vade textures is RGB A8 which is unsigned and
10:2110 minutes, 21 secondsnormalized that means it can only hold data in the range of 0 to 1 that means if you try to convert a Shader that stores values outside of the that range
10:3010 minutes, 30 secondsin textures the data will be truncated to within the range and it will probably break your Shader now you're totally
10:3610 minutes, 36 secondsstuck in the mro zone sad face for most things you'll want to use a sign float format like rgpa 16f I learned that
10:4510 minutes, 45 secondslesson the Hardway so you don't have to beyond that the A10 function is not overloaded like in Shader toy instead there are implementations of A10 and
10:5310 minutes, 53 secondsa102 which are not the same thing so I decided on some games to show this effect on combat Master Batman Arkham
11:0111 minutes, 1 secondCity the demo and life is strange combat Master is a multiplayer
11:1011 minutes, 10 secondsonline firstperson shooter that was able to use reshade on without being banned firsters Shooters are probably the worst type of game to run this effect on right
11:1911 minutes, 19 secondsnow they demand quick Reaction Time based on attention to details in the environment
11:3111 minutes, 31 secondshere the details I need to look out for are players with red writing over their heads the bad guys the red writing is easy to miss with all the paint and
11:4011 minutes, 40 secondssometimes I confuse red paint Strokes that came from lights or other things with an enemy signal beyond that I Rely more on sounds like bullets whizzing
11:4811 minutes, 48 secondspast but it's usually Too Late by then you can tell when you've successfully killed someone because there's this gold stuff that comes out and a cha-ching
11:5611 minutes, 56 secondsnoise of course if you play this game a lot already you you already know what to
12:0312 minutes, 3 secondslook for this is just a new game for me I tried to cherry pick most of my kills which were few and far between I think I got six kills in my best round but I
12:1112 minutes, 11 secondsfound the whole experience really fun I really feel like this effect could be useful in the story mode of a firstperson shooter where the character
12:1912 minutes, 19 secondsends up with some sort of psychological impairment or otherwise just as a way to make a battle more dramatic or emotional
12:3412 minutes, 34 secondsBatman Arkham City is another game I played for the first time there are definitely prompts and actions you have to take that are hard or impossible with
12:4112 minutes, 41 secondsthis effect on all units this is air tiger 4 I was still able to fly through the city just fine though and handle the
12:4912 minutes, 49 seconds10 guys with baseball bats and crowbars if this game is mostly hand toand combat I think an improvement would be setting the painting layers based on depth that
12:5812 minutes, 58 secondsway we can get more of the painly effect while it stays playable with this effect on things like anti-aliasing won't make a difference so if you're worried about
13:0613 minutes, 6 secondsusing this on a graphics heavy game there are probably things you can turn off like I am here the last thing I'll say is this
13:1513 minutes, 15 secondsgame is fairly dark and gloomy but I was surprised how painly the darker tones
13:2613 minutes, 26 secondslooked the only way to get by in this place is to get ourselves some respect dear that's how we get respect
13:3513 minutes, 35 secondswa that was so surreal famously called film little pieces of time I think painly effects in general have the most
13:4413 minutes, 44 secondspotential for more artsy or story based games just like 11-11 life is trained is a story Adventure game and the main
13:5113 minutes, 51 secondscharacter is a photographer in art school how can I show this to Mr Jefferson I can hear the class laughing
13:5813 minutes, 58 secondsat me now the main character moves fairly slowly which means less artifacts as the camera moves it helps that there are a lot of saturated colors and not
14:0714 minutes, 7 secondstoo much detail I like the effect the lookup tables have on this game the most this one for example makes it feel like you stayed way too late at school which
14:1614 minutes, 16 secondsis at least for me an eily familiar feeling I think this game could be playable if you make the highest level of detail paint Strokes small enough to
14:2414 minutes, 24 secondsread the text a game built with this effect would just have all the text options over top so it would be
14:3314 minutes, 33 secondsfine the performance shown on this laptop is with an RTX 4060 GPU this Shader takes 2 to 4 milliseconds per
14:4114 minutes, 41 secondsframe on reshade which is great there are still a lot of ways to improve it though like using a single Channel version of the metal texture and reducing the use of texture calls and
14:5014 minutes, 50 secondstrig functions in general games using direct x9c like life is strange and Batman Arkham City seem to not run the
14:5814 minutes, 58 secondsShader properly and show crazy high run times like 60 to 80 milliseconds on reshade even though they still run at 60
15:0515 minutes, 5 secondsframes per second when they do work games running direct X11 and up seem to run as expected my assumption is any game that fits this profile direct X11
15:1415 minutes, 14 secondsand up at which your computer can run should run this Shader without issue a lot of my time was spent just training my eye to what looks pain and then to
15:2315 minutes, 23 secondswhat looks like a van go painting versus what didn't so much of this project was waking up the next day looking at the effect not liking it and spending a few
15:3215 minutes, 32 secondsmore hours trying to fix it it's even more complicated because a lot of the things that make it more painterly can make it less readable especially in a
15:3915 minutes, 39 secondsreal-time context part of the problem with emulating Van go specifically was that he was being influenced by so many artists himself he reminds me of Bruce
15:4815 minutes, 48 secondsLee creating a style out of a bunch of elements that work for him I'll close here by saying that studying art and Graphics programming in this way has
15:5715 minutes, 57 secondsgiven me a new perspective on both I look forward to hearing your thoughts on all of this as well thanks for watching and I'll see you in the next one
16:0616 minutes, 6 seconds[Music]
```
