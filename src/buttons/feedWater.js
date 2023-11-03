const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const userModel = require("../util/Models/userModel");
const speechBubbles = require("../data/speechbubbles.json");
const timeStamps = require("../util/timeStamp");
const variables = require("../data/variableNames");

module.exports = {
  data: {
    name: "feedWater",
    description: "Button to give your pet water",
  },
  async execute(interaction, client) {
    await interaction.deferUpdate();

    const userId = interaction.user.id;
    const userDb = await userModel.findOne({ userId });
    if (!userDb) {
      console.error("User not found:", userId);
      return;
    }

    const petName = userDb.petName ? userDb.petName : "Your pet";
    const now = new Date();

    const petTypeStrMap = {
      1: "dog",
      2: "cat",
      3: "redPanda",
    };

    const petTypeStr = petTypeStrMap[userDb.petType];
    if (!petTypeStr) {
      console.error("Invalid pet type:", userDb.petType);
      return;
    }

    const randomDrinkingSound =
      speechBubbles.drinkingSounds[
        Math.floor(Math.random() * speechBubbles.drinkingSounds.length)
      ];

    const randomPetSound =
      speechBubbles[petTypeStr][
        Math.floor(Math.random() * speechBubbles[petTypeStr].length)
      ];

    // Determine if the pet can drink based on thirst level and time since last drink
    let canDrink = userDb.thirst < 100;

    // Check if there have been 3 drinks in the last 10 minutes
    const lastThreeDrank = userDb.actionTimestamps.lastDrank.slice(-3);
    if (lastThreeDrank.length === 3) {
      const tenMinutesAgo = now.getTime() - timeStamps.tenMinutes();
      const drinkTimesWithinTenMinutes = lastThreeDrank.filter(
        (time) => new Date(time).getTime() > tenMinutesAgo
      ).length;

      // If there are 3 drink times within the last 10 minutes, disable drinking
      canDrink = drinkTimesWithinTenMinutes < 3;
    }

    // If the pet cannot drink, send a message and return
    if (!canDrink || userDb.thirst >= 100) {
      const tooMuchDrinkEmbed = new EmbedBuilder()
        .setColor("#9e38fe")
        .setTitle("Oh no!")
        .setDescription(
          `${randomPetSound}! ${petName} has had enough to drink recently. Try again later.`
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [tooMuchDrinkEmbed],
        components: [],
      });
      return;
    }

    // Add the current timestamp to the last drank array
    userDb.actionTimestamps.lastDrank.push(now);
    // Keep only the last 3 timestamps
    while (userDb.actionTimestamps.lastDrank.length > 3) {
      userDb.actionTimestamps.lastDrank.shift();
    }

    // Increase thirst by a random amount
    const increaseThirstBy = Math.floor(Math.random() * 15) + 1;
    userDb.thirst = Math.min(userDb.thirst + increaseThirstBy, 100);
    const energyIncrease = Math.floor(0.3 * increaseThirstBy);
    userDb.energy = Math.min(userDb.energy + energyIncrease, 100);

    // Increment the drink count
    userDb.drinkCount += 1;

    // Update the user in the database
    await userModel.findOneAndUpdate(
      { userId: interaction.user.id },
      {
        $set: {
          actionTimestamps: userDb.actionTimestamps,
          thirst: userDb.thirst,
          energy: userDb.energy,
          drinkCount: userDb.drinkCount,
        },
      }
    );

    // Create the embed for a successful drink
    const updatedWaterEmbed = new EmbedBuilder()
      .setColor("#3399ff")
      .setTitle(`You gave ${petName} some water!`)
      .setDescription(
        `${randomPetSound}! ${petName} ${randomDrinkingSound}s the water happily! Their thirst level is now ${variables.getThirst(
          userDb.thirst
        )}.`
      )
      .setFooter({
        text: `Thirst Level: ${variables.getThirst(userDb.thirst)}`,
      })
      .setTimestamp();

    // Create the button for giving more water
    const waterAgainButton = new ButtonBuilder()
      .setCustomId("feedWater")
      .setLabel("Give More Water")
      .setStyle("Primary")
      .setDisabled(!canDrink);

    // Send the reply with the embed and the button
    await interaction.editReply({
      embeds: [updatedWaterEmbed],
      components: [new ActionRowBuilder().addComponents(waterAgainButton)],
    });
  },
};
