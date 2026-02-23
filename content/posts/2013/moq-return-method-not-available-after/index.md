---
title: "Moq Return method not available after Setup"
date: 2013-03-04T21:26:00.000+01:00
tags: ["C#", "Moq", "Unit Tests"]
author: "Bruno Garcia"
showToc: false
draft: false
cover:
    image: "Moq-Return-method-not-available.png"
    relative: true
    small: true
aliases:
  - /blogger/2013/moq-return-method-not-available-after/
  - /2013/03/moq-return-method-not-available-after.html
description: "Fix for Moq Return method not showing after Setup — caused by missing generic type parameter when mocking methods."
---

If you are familiar with the mocking framework [Moq](https://code.google.com/p/moq/), you're used to call `Setup` with the overload taking a `Func<T, TResult>` and expect after that the `Return<TResult>` method to be available. And it's normally there.

However, I just ran into an interesting scenario, where calling the correct overload did not make available the `Return<TResult>` method.

In my case the code being mocked is a dependency that makes a request on a webservice. A mockup of the wrapper class is created, and the `Load` method, which returns an `XDocument`, is setup.

But `Return` wasn't available:

![Moq Return method not available](Moq-Return-method-not-available.png)

Interesting that the overload resolution resolved my `Func<T, TResult>` to `Action<T>`, therefore `ISetup<T>` was being returned instead of `ISetup<T, TResult>` even though the method I setup had return type!

I inspect the method I setup to double check the return type defined:

![Moq Return type](Moq-Return-type.png)

Yes, it's missing a reference to `System.Xml.Linq`. The Unit Test Project template doesn't include a reference to this assembly (and that makes sense).

Well, I added it, it works now.
